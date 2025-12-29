import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout({ activeTab, setActiveTab, selectedFile }) {
  
  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <Sidebar 
         activeTab={activeTab} 
         setActiveTab={setActiveTab} 
         selectedFile={selectedFile}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
         <Outlet />
      </div>
    </div>
  );
}
