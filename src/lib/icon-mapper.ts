/**
 * Maps tech keywords to Simple Icons SVG slugs.
 * CDN URL: https://cdn.simpleicons.org/{slug}/{hexColor}
 */
const ICON_MAP: Record<string, string> = {
  // Cloud & Infrastructure
  'aws': 'amazonaws', 'amazon': 'amazonaws', 'ec2': 'amazonec2',
  's3': 'amazons3', 'lambda': 'awslambda',
  'gcp': 'googlecloud', 'google cloud': 'googlecloud',
  'azure': 'microsoftazure',
  'docker': 'docker', 'kubernetes': 'kubernetes', 'k8s': 'kubernetes',
  'terraform': 'terraform', 'ansible': 'ansible',

  // Databases
  'redis': 'redis', 'mongodb': 'mongodb', 'mysql': 'mysql',
  'postgresql': 'postgresql', 'postgres': 'postgresql',
  'cassandra': 'apachecassandra', 'dynamodb': 'amazondynamodb',
  'elasticsearch': 'elasticsearch', 'sqlite': 'sqlite',

  // Message Queues
  'kafka': 'apachekafka', 'rabbitmq': 'rabbitmq',
  'sqs': 'amazonsqs',

  // Languages
  'python': 'python', 'javascript': 'javascript', 'typescript': 'typescript',
  'java': 'openjdk', 'go': 'go', 'rust': 'rust',
  'c++': 'cplusplus', 'c#': 'csharp',

  // Frameworks
  'react': 'react', 'node': 'nodedotjs', 'nodejs': 'nodedotjs',
  'express': 'express', 'django': 'django', 'flask': 'flask',
  'spring': 'spring', 'fastapi': 'fastapi',

  // Tools
  'git': 'git', 'github': 'github', 'nginx': 'nginx',
  'apache': 'apache', 'grafana': 'grafana', 'prometheus': 'prometheus',
  'jenkins': 'jenkins', 'linux': 'linux',

  // Protocols & APIs
  'graphql': 'graphql', 'grpc': 'grpc',

  // CDN & Caching
  'cloudflare': 'cloudflare', 'varnish': 'varnish',

  // Indian Companies
  'flipkart': 'flipkart', 'swiggy': 'swiggy',
};

/**
 * Get Simple Icons slug for a tech keyword.
 * Returns null if no match found.
 */
export function getIconSlug(keyword: string): string | null {
  const lower = keyword.toLowerCase().replace(/[^a-z0-9+# ]/g, '');
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  // Partial match
  for (const [key, slug] of Object.entries(ICON_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return slug;
  }
  return null;
}

/**
 * Get CDN URL for a Simple Icon with custom color.
 */
export function getIconUrl(slug: string, hexColor: string = 'ffffff'): string {
  return `https://cdn.simpleicons.org/${slug}/${hexColor.replace('#', '')}`;
}
