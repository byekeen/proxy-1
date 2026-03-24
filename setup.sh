#!/bin/bash

# Quick setup script for Binance Proxy
# This is for LOCAL development. For production, deploy to Vercel.

set -e

echo "🚀 Setting up Binance Proxy (Development)..."

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env not found"
    echo "Creating from template..."
    cat > .env << 'EOF'
# Binance API Keys
BINANCE_KEY=your_key_here
BINANCE_SECRET=your_secret_here

# Proxy port (dev only)
PORT=3006
EOF
    echo ""
    echo "⚠️  IMPORTANT: Edit .env with your credentials:"
    echo "   - BINANCE_KEY=your_key_here"
    echo "   - BINANCE_SECRET=your_secret_here"
    echo ""
    exit 1
fi

echo "✓ .env configured"

# Display next steps
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Review .env:"
echo "     cat .env"
echo ""
echo "  2. Start proxy (development):"
echo "     npm run dev"
echo ""
echo "  3. For PRODUCTION deployment to Vercel:"
echo "     a. Push to GitHub"
echo "     b. Connect to Vercel dashboard"
echo "     c. Set environment variables: BINANCE_KEY and BINANCE_SECRET"
echo "     d. Deploy"
echo ""

