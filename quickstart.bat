@echo off
echo 🚀 Starting Opencode Studio setup...

echo 📦 Installing root dependencies...
call npm install

echo 📦 Installing frontend dependencies...
cd client-next
call npm install
cd ..

echo 📦 Installing backend dependencies...
cd server
call npm install
cd ..

echo ✨ Setup complete! Starting the application...
npm start
