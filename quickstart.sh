#!/bin/bash

# Opencode Studio Quickstart Script
echo "🚀 Starting Opencode Studio setup..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd client-next && npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server && npm install
cd ..

echo "✨ Setup complete! Starting the application..."
npm start
