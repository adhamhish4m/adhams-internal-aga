import { AdminPanel } from '@/components/AdminPanel';
import { Navigation } from '@/components/Navigation';

const AdminPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 pt-20">
        <AdminPanel />
      </div>
    </div>
  );
};

export default AdminPage;