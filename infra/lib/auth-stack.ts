import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

interface OnThiLabAuthStackProps extends StackProps {
  stage: string;
  domainPrefix: string;
  callbackUrls: string[];
  logoutUrls: string[];
  googleSecretName: string;
}

export class OnThiLabAuthStack extends Stack {
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

    const domain = userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: props.domainPrefix,
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const googleOauthSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GoogleOauthSecret",
      props.googleSecretName,
    );
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "GoogleProvider",
      {
        userPool,
        clientId: googleOauthSecret
          .secretValueFromJson("clientId")
          .unsafeUnwrap(),
        clientSecretValue:
          googleOauthSecret.secretValueFromJson("clientSecret"),
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
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

    const domainBaseUrl = `https://${props.domainPrefix}.auth.${this.region}.amazoncognito.com`;
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
    new CfnOutput(this, "ManagedLoginUrl", {
      value: managedLoginUrl,
      description: "Development managed login test URL",
    });
  }
}
