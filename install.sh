#!/bin/bash
echo "Installing Opencode Studio dependencies..."

echo "Installing root dependencies..."
npm install

echo "Installing frontend dependencies..."
cd client-next && npm install
cd ..

echo "Installing backend dependencies..."
cd server && npm install
cd ..

echo "Installation complete!"
