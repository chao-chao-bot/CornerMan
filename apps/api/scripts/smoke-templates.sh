#!/usr/bin/env bash
# R1 模板数据层后端 curl 烟测。
# 前置：infra:up + prisma migrate + prisma:seed + api 正在跑（默认 http://localhost:4000）。
# 依赖：curl、jq。
#
# 用法：
#   BASE_URL=http://localhost:4000 bash apps/api/scripts/smoke-templates.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API="$BASE_URL/api"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

# 提取 HTTP 状态码（最后一行）与响应体
req() {
  # req METHOD PATH [JSON_BODY] [TOKEN]
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -o /tmp/cm_resp.json -w '%{http_code}' -X "$method" "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  curl "${args[@]}"
}

echo "== R1 模板数据层烟测 @ $API =="

# 1. 注册 A（随机邮箱）取 token
SUFFIX="$(date +%s)$RANDOM"
EMAIL_A="smoke_a_${SUFFIX}@test.dev"
USER_A="smoke_a_${SUFFIX}"
code=$(req POST /auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"$USER_A\",\"password\":\"Passw0rd!23\"}")
TOKEN_A=$(jq -r '.tokens.accessToken' /tmp/cm_resp.json)
[ "$code" = "201" ] && [ "$TOKEN_A" != "null" ] && pass "注册用户 A 取得 accessToken" || fail "注册用户 A 失败 (HTTP $code)"

# 2. GET /templates 含 3 套系统模板
code=$(req GET /templates "" "$TOKEN_A")
SYS_COUNT=$(jq '[.[] | select(.isSystem == true)] | length' /tmp/cm_resp.json)
[ "$code" = "200" ] && [ "$SYS_COUNT" -ge 3 ] && pass "GET /templates 含 $SYS_COUNT 套系统模板" || fail "系统模板数不足 (HTTP $code, count=$SYS_COUNT)"
SYS_TPL_ID=$(jq -r '[.[] | select(.isSystem == true)][0].id' /tmp/cm_resp.json)

# 3. 创建自定义模板
NEW_TPL='{"name":"力量体能训练","scene":"custom","description":"自建","schema":{"version":1,"blocks":[{"id":"strength","type":"rich_text","title":"力量动作"},{"id":"rpe","type":"rating","title":"RPE"}]}}'
code=$(req POST /templates "$NEW_TPL" "$TOKEN_A")
CUSTOM_ID=$(jq -r '.id' /tmp/cm_resp.json)
IS_SYS=$(jq -r '.isSystem' /tmp/cm_resp.json)
[ "$code" = "201" ] && [ "$CUSTOM_ID" != "null" ] && [ "$IS_SYS" = "false" ] && pass "创建自定义模板 ($CUSTOM_ID)" || fail "创建自定义模板失败 (HTTP $code)"

# 4. 非法 schema（blocks 空）应 400
BAD_TPL='{"name":"坏模板","scene":"custom","schema":{"version":1,"blocks":[]}}'
code=$(req POST /templates "$BAD_TPL" "$TOKEN_A")
[ "$code" = "400" ] && pass "非法 schema 被拒 (HTTP 400)" || fail "非法 schema 未被拒 (HTTP $code)"

# 5. 用系统模板创建 Session，校验 templateSnapshot + 空 content 骨架
SESS="{\"title\":\"私教课复盘\",\"trainingType\":\"private_lesson\",\"trainedAt\":\"2026-06-12T10:00:00.000Z\",\"templateId\":\"$SYS_TPL_ID\"}"
code=$(req POST /training-sessions "$SESS" "$TOKEN_A")
SESS_ID=$(jq -r '.id' /tmp/cm_resp.json)
HAS_SNAP=$(jq '.templateSnapshot.blocks | length' /tmp/cm_resp.json)
HAS_CONTENT=$(jq '.content | keys | length' /tmp/cm_resp.json)
[ "$code" = "201" ] && [ "$HAS_SNAP" -ge 1 ] && [ "$HAS_CONTENT" -ge 1 ] && pass "建 Session 带快照($HAS_SNAP blocks) + 空内容骨架($HAS_CONTENT keys)" || fail "Session 快照/内容骨架缺失 (HTTP $code)"

# 6. PATCH content -> GET 校验持久化 + savedAt
CONTENT='{"content":{"coach_correction":{"type":"rich_text","plainText":"jab 回手太慢"}}}'
code=$(req PATCH "/training-sessions/$SESS_ID/content" "$CONTENT" "$TOKEN_A")
[ "$code" = "200" ] && pass "PATCH content (HTTP 200)" || fail "PATCH content 失败 (HTTP $code)"
code=$(req GET "/training-sessions/$SESS_ID" "" "$TOKEN_A")
SAVED_TEXT=$(jq -r '.content.coach_correction.plainText' /tmp/cm_resp.json)
SAVED_AT=$(jq -r '.savedAt' /tmp/cm_resp.json)
[ "$SAVED_TEXT" = "jab 回手太慢" ] && [ "$SAVED_AT" != "null" ] && pass "content 持久化且 savedAt 有值" || fail "content 未持久化 (text=$SAVED_TEXT, savedAt=$SAVED_AT)"

# 7. PATCH meta 带 outcome -> 回显
META='{"outcome":{"result":"loss","opponent":"蓝队","rounds":3,"note":"后手回防慢"}}'
code=$(req PATCH "/training-sessions/$SESS_ID/meta" "$META" "$TOKEN_A")
RESULT=$(jq -r '.outcome.result' /tmp/cm_resp.json)
[ "$code" = "200" ] && [ "$RESULT" = "loss" ] && pass "PATCH meta outcome 回显 (result=loss)" || fail "outcome 回显失败 (HTTP $code, result=$RESULT)"

# 8. 跨用户访问他人自定义模板应 404
EMAIL_B="smoke_b_${SUFFIX}@test.dev"
USER_B="smoke_b_${SUFFIX}"
req POST /auth/register "{\"email\":\"$EMAIL_B\",\"username\":\"$USER_B\",\"password\":\"Passw0rd!23\"}" >/dev/null
TOKEN_B=$(jq -r '.tokens.accessToken' /tmp/cm_resp.json)
code=$(req GET "/templates/$CUSTOM_ID" "" "$TOKEN_B")
[ "$code" = "404" ] && pass "用户 B 读用户 A 自定义模板被拒 (HTTP 404)" || fail "跨用户隔离失败 (HTTP $code)"

# 9. 用户 B 改用户 A 模板应 403
code=$(req PATCH "/templates/$CUSTOM_ID" '{"name":"hack"}' "$TOKEN_B")
[ "$code" = "403" ] && pass "用户 B 改用户 A 模板被拒 (HTTP 403)" || fail "越权修改未被拒 (HTTP $code)"

# 10. 改系统模板应 403
code=$(req PATCH "/templates/$SYS_TPL_ID" '{"name":"hack"}' "$TOKEN_A")
[ "$code" = "403" ] && pass "系统模板不可改 (HTTP 403)" || fail "系统模板被改 (HTTP $code)"

echo ""
echo "== 结果：通过 $PASS / 失败 $FAIL =="
[ "$FAIL" -eq 0 ]
