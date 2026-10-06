import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

interface OnThiLabAuthStackProps extends StackProps {
  stage: string;
  domainPrefix: string;
  /**
   * Optional branded domain such as `auth.onthilab.id.vn`. Cognito serves it
   * through CloudFront, so the certificate must live in us-east-1.
   */
  customDomain?: {
    domainName: string;
    certificateArn: string;
  };
  callbackUrls: string[];
  logoutUrls: string[];
  googleClientIdParameterName: string;
  googleClientSecretParameterName: string;
}

export class OnThiLabAuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly cognitoDomainBaseUrl: string;

  constructor(scope: Construct, id: string, props: OnThiLabAuthStackProps) {
    super(scope, id, props);

    const isProduction = props.stage === "prod";
    const removalPolicy = isProduction
      ? RemovalPolicy.RETAIN
      : RemovalPolicy.DESTROY;

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `onthilab-${props.stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(3),
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: isProduction,
      removalPolicy,
    });

    userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: props.domainPrefix,
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // A user pool can host one prefix domain and one custom domain at once.
    // Keep the prefix domain alive so existing clients and the Google redirect
    // URI keep working while traffic moves to the branded domain.
    const customDomain = props.customDomain
      ? userPool.addDomain("CustomDomain", {
          customDomain: {
            domainName: props.customDomain.domainName,
            certificate: acm.Certificate.fromCertificateArn(
              this,
              "CustomDomainCertificate",
              props.customDomain.certificateArn,
            ),
          },
          managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
        })
      : undefined;

    // Cognito's CloudFormation resource does not support ssm-secure dynamic
    // references. These parameters are therefore standard String parameters;
    // IAM access is restricted to deployment operators and values are never
    // exposed as stack outputs or browser configuration.
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this,
      props.googleClientIdParameterName,
    );
    const googleClientSecret = ssm.StringParameter.valueForStringParameter(
      this,
      props.googleClientSecretParameterName,
    );
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "GoogleProvider",
      {
        userPool,
        clientId: googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        },
      },
    );

    const userPoolClient = userPool.addClient("WebClient", {
      userPoolClientName: `onthilab-web-${props.stage}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
      },
    });
    userPoolClient.node.addDependency(googleProvider);

    // Managed Login v2 returns "Login pages unavailable" until the app client
    // has a branding resource. Use Cognito's defaults now; this can be
    // customized later without changing the OAuth client or callback URLs.
    new cognito.CfnManagedLoginBranding(this, "ManagedLoginBranding", {
      userPoolId: userPool.userPoolId,
      clientId: userPoolClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    const prefixDomainBaseUrl = `https://${props.domainPrefix}.auth.${this.region}.amazoncognito.com`;
    const domainBaseUrl = props.customDomain
      ? `https://${props.customDomain.domainName}`
      : prefixDomainBaseUrl;
    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.cognitoDomainBaseUrl = domainBaseUrl;
    const localCallbackUrl = props.callbackUrls[0]!;
    const managedLoginUrl =
      `${domainBaseUrl}/oauth2/authorize` +
      `?response_type=code&client_id=${userPoolClient.userPoolClientId}` +
      `&redirect_uri=${encodeURIComponent(localCallbackUrl)}` +
      "&scope=openid+email+profile";

    new CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Set as COGNITO_USER_POOL_ID",
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Public SPA client ID; safe to expose to the browser",
    });
    new CfnOutput(this, "CognitoDomain", {
      value: domainBaseUrl,
      description: "Set as VITE_COGNITO_DOMAIN",
    });
    new CfnOutput(this, "GoogleRedirectUri", {
      value: `${domainBaseUrl}/oauth2/idpresponse`,
      description: "Exact redirect URI for the Google OAuth web client",
    });
    if (customDomain) {
      new CfnOutput(this, "CustomDomainCloudFrontTarget", {
        value: customDomain.cloudFrontEndpoint,
        description: "CNAME target for the Cognito custom domain DNS record",
      });
      new CfnOutput(this, "LegacyGoogleRedirectUri", {
        value: `${prefixDomainBaseUrl}/oauth2/idpresponse`,
        description: "Keep in the Google OAuth client until migration finishes",
      });
    }
    new CfnOutput(this, "ManagedLoginUrl", {
      value: managedLoginUrl,
      description: "Development managed login test URL",
    });
  }
}
