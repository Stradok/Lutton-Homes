// Production-only checks: a bad config should fail at boot, not on the first login.
export function validateConfig(config, env = process.env) {
	if (env.NODE_ENV !== 'production') return [];

	const problems = [];
	const owners = config.owners || {};
	const ownerNames = Object.keys(owners);
	const origins = config.allowedOrigins || [];

	if (ownerNames.length && (config.sessionSecret || '').length < 32) {
		problems.push('SESSION_SECRET must be at least 32 characters when owner accounts exist');
	}
	if (!config.adminToken && ownerNames.length === 0) {
		problems.push('No owner accounts or ADMIN_TOKEN are set, so nobody can use the dashboard');
	}
	if (config.adminToken && config.adminToken.length < 24) {
		problems.push('ADMIN_TOKEN must be at least 24 characters');
	}
	if (config.icalToken && config.icalToken.length < 24) {
		problems.push('ICAL_TOKEN must be at least 24 characters');
	}
	if (origins.length === 0) {
		problems.push('ALLOWED_ORIGINS must list at least one origin');
	}
	for (const origin of origins) {
		if (!origin.startsWith('https://')) {
			problems.push(`ALLOWED_ORIGINS entry "${origin}" must start with https://`);
		}
	}
	if (config.apiUrl && !config.apiUrl.startsWith('https://')) {
		problems.push('API_PUBLIC_URL must start with https://');
	}
	if (config.siteUrl && !config.siteUrl.startsWith('https://')) {
		problems.push('SITE_URL must start with https://');
	}
	if (config.deployHook && !config.deployHook.startsWith('https://')) {
		problems.push('DEPLOY_HOOK_URL must start with https://');
	}
	for (const name of ownerNames) {
		if (!String(owners[name]).startsWith('scrypt$')) {
			problems.push(`OWNERS entry "${name}" must be a scrypt hash`);
		}
	}
	return problems;
}

export function assertConfig(config, env = process.env) {
	const problems = validateConfig(config, env);
	if (problems.length) throw new Error(problems.join('\n'));
}
