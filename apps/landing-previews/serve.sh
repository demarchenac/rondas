#!/bin/bash
echo "🎨 Rondas Landing Page Previews"
echo "================================"
echo ""
echo "  01-editorial.html   → Minimal/Editorial (Swiss typography)"
echo "  02-glass.html       → Glassmorphism (iOS Liquid Glass inspired)"
echo "  03-geometric.html   → Bold/Geometric (Bento grid, brutalist)"
echo "  04-organic.html     → Organic/Warm (Colombian warmth)"
echo "  05-terminal.html    → Tech/Futuristic (Terminal aesthetic)"
echo ""
echo "Starting server on http://localhost:3333"
echo ""
cd "$(dirname "$0")"
python3 -m http.server 3333
