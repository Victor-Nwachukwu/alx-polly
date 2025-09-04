'use client';

import { useState, useEffect } from 'react';
import { updatePoll } from '@/app/lib/actions/poll-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EditPollForm({ poll }: { poll: any }) {
  const [question, setQuestion] = useState(poll.question);
  const [options, setOptions] = useState<string[]>(poll.options || []);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>("");

  useEffect(() => {
    // Generate CSRF token on client side
    const generateToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.token);
      } catch (err) {
        console.error('Failed to get CSRF token:', err);
      }
    };
    generateToken();
  }, []);

  const handleOptionChange = (idx: number, value: string) => {
    setOptions((opts) => opts.map((opt, i) => (i === idx ? value : opt)));
  };

  const addOption = () => setOptions((opts) => [...opts, '']);
  const removeOption = (idx: number) => {
    if (options.length > 2) {
      setOptions((opts) => opts.filter((_, i) => i !== idx));
    }
  };

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSuccess(false);
        
        // Add CSRF token
        formData.set('csrf-token', csrfToken);
        formData.set('question', question);
        formData.delete('options');
        options.forEach((opt) => formData.append('options', opt));
        
        const res = await updatePoll(poll.id, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            window.location.href = '/polls';
          }, 1200);
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="csrf-token" value={csrfToken} />
      
      <div>
        <Label htmlFor="question">Poll Question</Label>
        <Input
          name="question"
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          maxLength={500}
        />
        <p className="text-sm text-gray-500 mt-1">Maximum 500 characters</p>
      </div>
      <div>
        <Label>Options</Label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <Input
              name="options"
              value={opt}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
              required
              maxLength={200}
              placeholder={`Option ${idx + 1}`}
            />
            {options.length > 2 && (
              <Button type="button" variant="destructive" onClick={() => removeOption(idx)}>
                Remove
              </Button>
            )}
          </div>
        ))}
        <p className="text-sm text-gray-500 mb-2">Maximum 200 characters per option</p>
        <Button type="button" onClick={addOption} variant="secondary" disabled={options.length >= 10}>
          Add Option ({options.length}/10)
        </Button>
      </div>
      
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-600">Poll updated! Redirecting...</div>}
      
      <Button type="submit" disabled={!csrfToken}>Update Poll</Button>
    </form>
  );
}