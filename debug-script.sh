#!/bin/bash

echo "=== Rowboat + Ollama Debug Script ==="
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored status
print_status() {
    if [ $2 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

# Function to print section header
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# 1. Check if Ollama is running
print_section "1. Ollama Service Status"
curl -s http://localhost:11434/api/tags > /dev/null 2>&1
print_status "Ollama API accessible on localhost:11434" $?

curl -s http://172.17.0.1:11434/api/tags > /dev/null 2>&1
print_status "Ollama API accessible on 172.17.0.1:11434" $?

# 2. List available models
print_section "2. Available Ollama Models"
if command -v ollama &> /dev/null; then
    echo "Models in Ollama:"
    ollama list
else
    echo -e "${YELLOW}Warning: ollama command not found${NC}"
    echo "Trying to get models via API..."
    curl -s http://localhost:11434/api/tags | jq '.models[].name' 2>/dev/null || echo "Could not retrieve models"
fi

# 3. Test model availability
print_section "3. Testing Required Models"
REQUIRED_MODELS=("llama3.2:1b" "qwen2.5:0.5b" "nomic-embed-text")

for model in "${REQUIRED_MODELS[@]}"; do
    if command -v ollama &> /dev/null; then
        ollama list | grep -q "$model"
        print_status "Model $model available" $?
    else
        echo -e "${YELLOW}Skipping model check (ollama command not available)${NC}"
        break
    fi
done

# 4. Test Ollama API endpoints
print_section "4. Testing Ollama API Endpoints"

# Test chat completion
echo "Testing chat completion..."
CHAT_RESPONSE=$(curl -s -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }' 2>/dev/null)

if echo "$CHAT_RESPONSE" | grep -q "choices"; then
    print_status "Chat completion endpoint working" 0
else
    print_status "Chat completion endpoint failed" 1
    echo "Response: $CHAT_RESPONSE"
fi

# Test embeddings
echo "Testing embeddings..."
EMBED_RESPONSE=$(curl -s -X POST http://localhost:11434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "test"
  }' 2>/dev/null)

if echo "$EMBED_RESPONSE" | grep -q "data"; then
    print_status "Embeddings endpoint working" 0
else
    print_status "Embeddings endpoint failed" 1
    echo "Response: $EMBED_RESPONSE"
fi

# 5. Check Docker containers
print_section "5. Docker Container Status"
if command -v docker &> /dev/null; then
    echo "Docker containers:"
    docker compose ps
    
    echo -e "\nNetwork connectivity test from rowboat container:"
    # Test with wget instead of curl (which might not be available)
    docker compose exec -T rowboat sh -c "wget -qO- --timeout=5 http://172.17.0.1:11434/api/tags" > /dev/null 2>&1
    print_status "Rowboat can reach Ollama" $?
else
    echo -e "${RED}Docker not found${NC}"
fi

# 6. Check logs for errors
print_section "6. Recent Rowboat Logs (last 20 lines)"
if command -v docker &> /dev/null; then
    echo "Rowboat logs:"
    docker compose logs --tail=20 rowboat 2>/dev/null | grep -E "(error|Error|ERROR|fail|Fail|FAIL)" | tail -10
    
    echo -e "\nJobs-worker logs:"
    docker compose logs --tail=20 jobs-worker 2>/dev/null | grep -E "(error|Error|ERROR|fail|Fail|FAIL)" | tail -10
fi

# 7. Environment check
print_section "7. Environment Variables Check"
if [ -f .env ]; then
    echo "Checking .env file for Ollama configuration:"
    grep -E "(PROVIDER_BASE_URL|PROVIDER_DEFAULT_MODEL|EMBEDDING_MODEL)" .env 2>/dev/null || echo "Key variables not found in .env"
else
    echo -e "${YELLOW}Warning: .env file not found${NC}"
fi

# 8. System resources
print_section "8. System Resources"
echo "Memory usage:"
free -h | head -2

echo -e "\nDisk space:"
df -h / | tail -1

echo -e "\nCPU load:"
uptime

print_section "Debug Complete"
echo -e "If you see ${RED}✗${NC} marks above, those are the issues to fix."
echo "Share this output for further troubleshooting."