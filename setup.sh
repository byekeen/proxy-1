#!/bin/bash

# Quick setup script for Binance Proxy
# Run this from binance-proxy/ root directory

set -e

echo "🚀 Setting up Binance Proxy..."

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found"
    echo "Creating from template..."
    cp .env.local.example .env.local
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local with your credentials:"
    echo "   - BINANCE_KEY=your_key_here"
    echo "   - BINANCE_SECRET=your_secret_here"
    echo ""
    exit 1
fi

echo "✓ .env.local configured"

# Display next steps
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Review .env.local:"
echo "     cat .env.local"
echo ""
echo "  2. Start proxy:"
echo "     npm run dev        # Development"
echo "     npm start          # Production"
echo ""
echo "  3. Check stats (in another terminal):"
echo "     curl http://localhost:3006/api/stats | jq"
echo ""
echo "  4. Migrate bot (see ../scalping-bot/PROXY_MIGRATION.md)"
echo ""
