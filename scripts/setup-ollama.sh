#!/bin/bash

# Setup script for Ollama without Docker
# This script installs and configures Ollama locally

set -e

echo "🦙 Setting up Ollama without Docker..."

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
    ollama --version
else
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Check if Ollama service is running
if pgrep -x "ollama" > /dev/null; then
    echo "✅ Ollama service is running"
else
    echo "🚀 Starting Ollama service..."
    # Start ollama in background
    nohup ollama serve > /dev/null 2>&1 &
    sleep 5
fi

# Check if we can connect to Ollama
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is accessible at http://localhost:11434"
else
    echo "❌ Cannot connect to Ollama at http://localhost:11434"
    echo "Please check if Ollama is running properly"
    exit 1
fi

# Pull the required model
echo "📥 Pulling mxbai-large model..."
ollama pull mxbai-large

# Verify the model is available
if ollama list | grep -q "mxbai-large"; then
    echo "✅ mxbai-large model is available"
else
    echo "❌ Failed to pull mxbai-large model"
    exit 1
fi

echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Set OLLAMA_HOST=http://localhost:11434 in your .env file"
echo "2. Start PostgreSQL: docker-compose up -d postgres"
echo "3. Run migration scripts if needed"
echo ""
echo "🔍 Test Ollama:"
echo "  curl http://localhost:11434/api/tags"
echo "  ollama list"