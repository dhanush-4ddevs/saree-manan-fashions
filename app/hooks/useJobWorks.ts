import { useState, useEffect } from 'react';
import { getAllJobWorks, JobWork } from '@/config/firebase';

export const useJobWorks = () => {
  const [jobWorks, setJobWorks] = useState<JobWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobWorks = async () => {
      try {
        setLoading(true);
        setError(null);
        const jobWorksData = await getAllJobWorks();
        setJobWorks(jobWorksData);
      } catch (err) {
        console.error('Error fetching job works:', err);
        setError('Failed to fetch job works');
      } finally {
        setLoading(false);
      }
    };

    fetchJobWorks();
  }, []);

  const jobWorkNames = jobWorks.map(jobWork => jobWork.name);

  return {
    jobWorks,
    jobWorkNames,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      getAllJobWorks()
        .then(setJobWorks)
        .catch(err => {
          console.error('Error refetching job works:', err);
          setError('Failed to fetch job works');
        })
        .finally(() => setLoading(false));
    }
  };
};
