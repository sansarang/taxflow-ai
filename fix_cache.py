content = open('src/lib/redis/cache.ts').read()
content = content.replace(
    'results.map((r) => classifyCache.set(userId, r.txHash, r))',
    'results.map((r) => classifyCache.set(userId, (r as any).txHash ?? r.transactionId, r))'
)
open('src/lib/redis/cache.ts', 'w').write(content)
print('done')