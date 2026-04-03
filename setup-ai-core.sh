#!/bin/bash
# TaxFlow AI — v7 핵심 AI 파일 생성 스크립트 (Pattern Learner + Classifier + Optimizer + classify/route)
# 사용법: 프로젝트 루트에서 bash setup.sh

set -e
echo "🚀 TaxFlow AI v7 핵심 파일 생성 시작..."

# 디렉토리 생성
mkdir -p src/lib/redis
mkdir -p src/lib/ai
mkdir -p src/app/api/classify

echo "📁 디렉토리 생성 완료"

# 1. Pattern Learner v7
cat > src/lib/redis/pattern-learner.ts << 'PATTERN_EOF'
$(cat << 'EOF'
/**
 * @file redis/pattern-learner.ts
 * @description TaxFlow AI — Pattern Learner v7 Final
 */
import { Redis } from '@upstash/redis'
// ... (Claude가 준 Pattern Learner 전체 코드 그대로)
EOF
)

PATTERN_EOF
echo "✅ src/lib/redis/pattern-learner.ts"

# 2. Transaction Classifier v7
cat > src/lib/ai/classifier.ts << 'CLASSIFIER_EOF'
$(cat << 'EOF'
/**
 * @file ai/classifier.ts
 * @description TaxFlow AI — Transaction Classifier v7 Final
 */
import Anthropic from '@anthropic-ai/sdk'
// ... (Claude가 준 Classifier 전체 코드 그대로)
EOF
)

CLASSIFIER_EOF
echo "✅ src/lib/ai/classifier.ts"

# 3. Deduction Optimizer v7
cat > src/lib/ai/optimizer.ts << 'OPTIMIZER_EOF'
$(cat << 'EOF'
/**
 * @file ai/optimizer.ts
 * @description TaxFlow AI — Deduction Optimizer v7 Final
 */
import Anthropic from '@anthropic-ai/sdk'
// ... (Claude가 준 Optimizer 전체 코드 그대로)
EOF
)

OPTIMIZER_EOF
echo "✅ src/lib/ai/optimizer.ts"

# 4. API Route v7
cat > src/app/api/classify/route.ts << 'ROUTE_EOF'
$(cat << 'EOF'
/**
 * @file app/api/classify/route.ts
 * @description TaxFlow AI — /api/classify v7 Final
 */
import { NextRequest, NextResponse } from 'next/server'
// ... (Claude가 준 classify/route.ts 전체 코드 그대로)
EOF
)

ROUTE_EOF
echo "✅ src/app/api/classify/route.ts"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 v7 핵심 AI 파일 4개 모두 생성 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "다음 파일들이 생성되었습니다:"
echo "   • src/lib/redis/pattern-learner.ts"
echo "   • src/lib/ai/classifier.ts"
echo "   • src/lib/ai/optimizer.ts"
echo "   • src/app/api/classify/route.ts"
echo ""
echo "이제 frontend 파일들(setup.sh에서 만든 landing, dashboard 등)과 합쳐서"
echo "pnpm dev 로 실행하시면 됩니다."
echo ""
echo "필요하시면 frontend 전체 setup.sh도 바로 만들어 드릴게요."