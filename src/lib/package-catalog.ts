import { slugify } from "@/lib/utils";

export type Registry =
	| "npm"
	| "pypi"
	| "rubygems"
	| "packagist"
	| "maven"
	| "nuget"
	| "go"
	| "crates"
	| "hex"
	| "pub"
	| "swiftpackageindex";

export type AuthPackage = {
	id: string;
	ecosystem: string;
	name: string;
	target: string;
	category: string;
	provider: string;
	registry: Registry;
	sourceUrl: string;
};

type PackageTuple = readonly [ecosystem: string, name: string, target: string, category: string, provider: string];

const packageRows = [
	["JS/TS", "@clerk/nextjs", "Next.js", "Hosted auth SDK", "Clerk"],
	["JS/TS", "@workos-inc/authkit-nextjs", "Next.js App Router", "Hosted auth SDK", "WorkOS AuthKit"],
	["JS/TS", "better-auth", "TypeScript apps", "Auth framework", "Better Auth"],
	["JS/TS", "next-auth", "Next.js", "Auth framework", "Auth.js / NextAuth.js"],
	["JS/TS", "@auth0/nextjs-auth0", "Next.js", "Hosted auth SDK", "Auth0"],
	["JS/TS", "@aws-sdk/client-cognito-identity-provider", "Node.js / browser", "Cloud identity SDK", "Amazon Cognito"],
	["JS/TS", "stytch", "Node.js", "Hosted auth SDK", "Stytch"],
	["JS/TS", "@supabase/supabase-js", "JavaScript apps", "Backend/auth client", "Supabase"],
	["JS/TS", "firebase", "Web / Node.js", "Backend/auth client", "Firebase Authentication"],
	["JS/TS", "passport", "Express / Node.js", "Auth middleware", "Passport"],
	["JS/TS", "openid-client", "Node.js", "OAuth/OIDC client", "panva"],
	["JS/TS", "jose", "JavaScript runtimes", "JOSE/JWT library", "panva"],
	["JS/TS", "@azure/msal-browser", "Browser SPAs", "OAuth/OIDC client", "Microsoft Entra ID"],
	["JS/TS", "@okta/okta-auth-js", "Web / Node.js", "OIDC SDK", "Okta"],
	["Python", "django-allauth", "Django", "Auth framework", "django-allauth"],
	["Python", "django-oauth-toolkit", "Django / DRF", "OAuth2 provider", "Django OAuth Toolkit"],
	["Python", "social-auth-app-django", "Django", "Social auth integration", "Python Social Auth"],
	["Python", "Authlib", "Python web apps", "OAuth/OIDC/JOSE toolkit", "Authlib"],
	["Python", "PyJWT", "Python apps", "JWT library", "PyJWT"],
	["Python", "Flask-Login", "Flask", "Session auth", "Flask-Login"],
	["Python", "fastapi-users", "FastAPI", "User auth framework", "FastAPI Users"],
	["Ruby", "devise", "Rails", "Auth framework", "Devise"],
	["Ruby", "omniauth", "Rack / Rails", "OAuth strategy framework", "OmniAuth"],
	["Ruby", "doorkeeper", "Rails", "OAuth2 provider", "Doorkeeper"],
	["PHP", "laravel/sanctum", "Laravel", "SPA/API auth", "Laravel Sanctum"],
	["PHP", "laravel/passport", "Laravel", "OAuth2 server", "Laravel Passport"],
	["PHP", "league/oauth2-client", "PHP apps", "OAuth2 client", "PHP League"],
	["PHP", "firebase/php-jwt", "PHP apps", "JWT library", "Firebase"],
	["JVM", "org.springframework.security:spring-security-core", "Spring", "Security/auth framework", "Spring Security"],
	[
		"JVM",
		"org.springframework.boot:spring-boot-starter-oauth2-client",
		"Spring Boot",
		"OAuth2/OIDC client starter",
		"Spring Boot",
	],
	["JVM", "com.nimbusds:nimbus-jose-jwt", "Java / Kotlin", "JOSE/JWT library", "Nimbus"],
	["JVM", "com.auth0:java-jwt", "Java / Kotlin", "JWT library", "Auth0"],
	["JVM", "org.keycloak:keycloak-admin-client", "Java / Kotlin", "IAM admin client", "Keycloak"],
	[".NET", "Microsoft.AspNetCore.Authentication.JwtBearer", "ASP.NET Core", "JWT bearer middleware", "Microsoft"],
	[".NET", "Microsoft.Identity.Web", "ASP.NET Core", "Entra ID web auth", "Microsoft"],
	[".NET", "Microsoft.Identity.Client", ".NET apps", "OAuth/OIDC client", "Microsoft MSAL"],
	[".NET", "OpenIddict.AspNetCore", "ASP.NET Core", "OAuth/OIDC server/client", "OpenIddict"],
	[".NET", "Duende.IdentityServer", ".NET apps", "OAuth/OIDC server", "Duende IdentityServer"],
	["Go", "golang.org/x/oauth2", "Go apps", "OAuth2 client", "Go team"],
	["Go", "github.com/coreos/go-oidc/v3/oidc", "Go apps", "OIDC client/verifier", "CoreOS"],
	["Go", "github.com/golang-jwt/jwt/v5", "Go apps", "JWT library", "golang-jwt"],
	["Go", "github.com/auth0/go-jwt-middleware/v3", "Go HTTP APIs", "JWT middleware", "Auth0"],
	["Rust", "jsonwebtoken", "Rust apps", "JWT library", "jsonwebtoken"],
	["Rust", "oauth2", "Rust apps", "OAuth2 client", "oauth2-rs"],
	["Rust", "openidconnect", "Rust apps", "OIDC client", "openidconnect-rs"],
	["Elixir", "guardian", "Elixir / Phoenix", "Token auth framework", "Guardian"],
	["Elixir", "ueberauth", "Plug / Phoenix", "OAuth strategy framework", "Ueberauth"],
	["Dart/Flutter", "firebase_auth", "Flutter", "Hosted auth SDK", "Firebase Authentication"],
	["Dart/Flutter", "amplify_auth_cognito", "Flutter", "Cloud identity SDK", "AWS Cognito"],
	["Swift", "Auth0.swift", "iOS / macOS", "Hosted auth SDK", "Auth0"],
] as const satisfies readonly PackageTuple[];

export const AUTH_PACKAGES: AuthPackage[] = packageRows.map(([ecosystem, name, target, category, provider]) => {
	const registry = registryForEcosystem(ecosystem);

	return {
		id: slugify(`${ecosystem}-${name}`),
		ecosystem,
		name,
		target,
		category,
		provider,
		registry,
		sourceUrl: sourceUrlFor(registry, name),
	};
});

export const SUPPORTED_DOWNLOAD_REGISTRIES = new Set<Registry>([
	"npm",
	"pypi",
	"rubygems",
	"packagist",
	"nuget",
	"crates",
	"hex",
]);

function registryForEcosystem(ecosystem: string): Registry {
	switch (ecosystem) {
		case "JS/TS":
			return "npm";
		case "Python":
			return "pypi";
		case "Ruby":
			return "rubygems";
		case "PHP":
			return "packagist";
		case "JVM":
			return "maven";
		case ".NET":
			return "nuget";
		case "Go":
			return "go";
		case "Rust":
			return "crates";
		case "Elixir":
			return "hex";
		case "Dart/Flutter":
			return "pub";
		default:
			return "swiftpackageindex";
	}
}

function sourceUrlFor(registry: Registry, name: string) {
	switch (registry) {
		case "npm":
			return `https://www.npmjs.com/package/${name}`;
		case "pypi":
			return `https://pypi.org/project/${name}/`;
		case "rubygems":
			return `https://rubygems.org/gems/${name}`;
		case "packagist":
			return `https://packagist.org/packages/${name}`;
		case "maven": {
			const [group, artifact] = name.split(":");
			return `https://mvnrepository.com/artifact/${group}/${artifact}`;
		}
		case "nuget":
			return `https://www.nuget.org/packages/${name}`;
		case "go":
			return `https://pkg.go.dev/${name}`;
		case "crates":
			return `https://crates.io/crates/${name}`;
		case "hex":
			return `https://hex.pm/packages/${name}`;
		case "pub":
			return `https://pub.dev/packages/${name}`;
		case "swiftpackageindex":
			return "https://swiftpackageindex.com/auth0/Auth0.swift";
	}
}
