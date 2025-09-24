import { useState, useEffect, useMemo } from 'react';
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

  const jobWorkNames = useMemo(() => {
    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    for (const jobWork of jobWorks) {
      const originalName = (jobWork.name || '').trim();
      const key = originalName.toLowerCase();
      if (originalName && !seen.has(key)) {
        seen.add(key);
        uniqueNames.push(originalName);
      }
    }
    return uniqueNames;
  }, [jobWorks]);

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
