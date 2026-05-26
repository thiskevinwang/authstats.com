import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
	...nextVitals,
	...nextTypescript,
	{
		ignores: ["cloudflare-env.d.ts", ".open-next*/**", ".wrangler/**"],
	},
];

export default eslintConfig;
