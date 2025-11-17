import { UpdatedSimplifiedEnhancedForm } from '@/components/UpdatedSimplifiedEnhancedForm';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  const handleSubmissionSuccess = () => {
    navigate('/dashboard');
  };

  return <UpdatedSimplifiedEnhancedForm onSubmissionSuccess={handleSubmissionSuccess} />;
};

export default Index;
