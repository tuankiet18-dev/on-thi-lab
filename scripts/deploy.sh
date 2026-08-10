#!/usr/bin/env bash

# Usage: ./deploy-staging.sh | ./deploy-prod.sh --confirm-production
# Add --migrate only when the release includes a database migration.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh <staging|prod> [options]

Options:
  --web-only             Build and upload only the frontend.
  --infra-only           Deploy only the CDK application stack.
  --migrate              Run database migrations before infrastructure deploy.
  --skip-validate        Skip local validation (not recommended).
  --confirm-production   Required for every production deployment.
  -h, --help             Show this help.

Set WEB_CERTIFICATE_ARN to override ACM certificate auto-detection.
EOF
}

if [[ $# -lt 1 ]]; then usage >&2; exit 1; fi
stage="$1"
shift

web_only=false
infra_only=false
run_migrations=false
skip_validate=false
confirm_production=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) web_only=true ;;
    --infra-only) infra_only=true ;;
    --migrate) run_migrations=true ;;
    --skip-validate) skip_validate=true ;;
    --confirm-production) confirm_production=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

if [[ "$web_only" == true && "$infra_only" == true ]]; then
  echo "Use either --web-only or --infra-only, not both." >&2
  exit 1
fi

case "$stage" in
  staging)
    web_domain="staging.onthilab.id.vn"
    vite_mode="staging"
    database_parameter_name="/onthilab/staging/database"
    ;;
  prod)
    web_domain="onthilab.id.vn"
    vite_mode="production"
    database_parameter_name="/onthilab/prod/database"
    if [[ "$confirm_production" != true ]]; then
      echo "Production deployment requires --confirm-production." >&2
      exit 1
    fi
    ;;
  *) echo "Stage must be staging or prod." >&2; exit 1 ;;
esac

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
aws_region="${AWS_REGION:-ap-southeast-1}"
certificate_region="us-east-1"
stack_name="OnThiLab-${stage}"
env_file=".env.${vite_mode}"

for command in aws pnpm curl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done
[[ -f "$env_file" ]] || {
  echo "Missing $env_file. Refusing to build with an unintended Vite mode." >&2
  exit 1
}

account_id="$(aws sts get-caller-identity --query Account --output text)"
[[ -n "$account_id" && "$account_id" != "None" ]] || {
  echo "Unable to identify the AWS account." >&2
  exit 1
}

stack_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --region "$aws_region" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

certificate_arn="${WEB_CERTIFICATE_ARN:-}"
if [[ -z "$certificate_arn" ]]; then
  certificate_domain="$web_domain"
  if [[ "$stage" == "staging" ]]; then
    # The issued certificate's primary name is the apex and it carries the
    # wildcard as a SAN, so ACM list output is indexed by the apex name.
    certificate_domain="onthilab.id.vn"
  fi
  certificate_arn="$(aws acm list-certificates \
    --region "$certificate_region" \
    --certificate-statuses ISSUED \
    --query "CertificateSummaryList[?DomainName=='${certificate_domain}'].CertificateArn | [0]" \
    --output text)"
fi
[[ -n "$certificate_arn" && "$certificate_arn" != "None" ]] || {
  echo "No issued ACM certificate found for ${web_domain} in ${certificate_region}." >&2
  echo "Set WEB_CERTIFICATE_ARN to use an explicit certificate." >&2
  exit 1
}

if [[ "$skip_validate" != true ]]; then
  echo "==> Validating workspace"
  pnpm validate
fi

if [[ "$run_migrations" == true ]]; then
  echo "==> Running ${stage} database migrations"
  database_url="$(aws ssm get-parameter \
    --region "$aws_region" \
    --name "$database_parameter_name" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)"
  DATABASE_URL="$database_url" pnpm --filter @onthilab/database migrate
fi

if [[ "$web_only" != true ]]; then
  echo "==> Deploying ${stack_name} to AWS account ${account_id}"
  (
    cd infra
    pnpm exec cdk deploy "$stack_name" \
      -c "stage=${stage}" \
      -c "databaseParameterName=${database_parameter_name}" \
      -c "webBaseUrl=https://${web_domain}" \
      -c "webDomainName=${web_domain}" \
      -c "webCertificateArn=${certificate_arn}" \
      --require-approval never
  )

  api_endpoint="$(stack_output ApiEndpoint)"
  [[ -n "$api_endpoint" && "$api_endpoint" != "None" ]] || {
    echo "Could not read ApiEndpoint from ${stack_name}." >&2
    exit 1
  }
  echo "==> Checking API health"
  curl --fail --silent --show-error --max-time 20 "${api_endpoint%/}/health" >/dev/null
fi

if [[ "$infra_only" != true ]]; then
  echo "==> Building ${stage} frontend"
  pnpm --filter @onthilab/web exec vite build --mode "$vite_mode"

  web_bucket_name="$(stack_output WebBucketName)"
  [[ -n "$web_bucket_name" && "$web_bucket_name" != "None" ]] || {
    echo "Could not read WebBucketName from ${stack_name}." >&2
    exit 1
  }
  echo "==> Uploading frontend assets"
  aws s3 sync apps/web/dist "s3://${web_bucket_name}" --delete --only-show-errors

  distribution_id="$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '${web_domain}')].Id | [0]" \
    --output text)"
  [[ -n "$distribution_id" && "$distribution_id" != "None" ]] || {
    echo "Could not find a CloudFront distribution for ${web_domain}." >&2
    exit 1
  }
  invalidation_id="$(aws cloudfront create-invalidation \
    --distribution-id "$distribution_id" \
    --paths '/*' \
    --query 'Invalidation.Id' \
    --output text)"
  echo "==> CloudFront invalidation created: ${invalidation_id}"
fi

echo "Deployment submitted successfully: https://${web_domain}"
