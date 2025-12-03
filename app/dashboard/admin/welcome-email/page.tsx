'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

type WelcomeEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export default function WelcomeEmailEditor() {
  const [template, setTemplate] = useState<WelcomeEmailTemplate>({
    subject: '',
    html: '',
    text: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and superadmin status
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          // Load the template
          fetch('/api/admin/welcome-email')
            .then((res) => res.json())
            .then((emailData) => {
              if (emailData.template) {
                setTemplate(emailData.template);
              }
              setIsLoading(false);
            })
            .catch((err) => {
              console.error('Error loading template:', err);
              setError('Failed to load email template');
              setIsLoading(false);
            });
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/welcome-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccess('Welcome email template saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate preview HTML with sample data
  const getPreviewHtml = () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const year = new Date().getFullYear();
    return template.html
      .replace(/\$\{firstName\}/g, 'John')
      .replace(/\$\{appUrl\}/g, appUrl)
      .replace(/\$\{year\}/g, year.toString());
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-semibold text-slate-50 mb-2">
            Welcome Email Editor
          </h1>
          <p className="text-slate-400 text-sm">
            Edit the welcome email message that is sent to new users when they sign up.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Subject */}
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Email Subject
            </label>
            <input
              type="text"
              id="subject"
              value={template.subject}
              onChange={(e) =>
                setTemplate({ ...template, subject: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              placeholder="Welcome to Household Toolbox! 🧰"
            />
          </div>

          {/* HTML Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="html"
                className="block text-sm font-medium text-slate-300"
              >
                HTML Content
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Use <code className="text-emerald-400">{'${firstName}'}</code>, <code className="text-emerald-400">{'${appUrl}'}</code>, and <code className="text-emerald-400">{'${year}'}</code> as template variables
            </p>
            {showPreview ? (
              <div className="rounded-lg border border-slate-700 bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 text-xs text-slate-600 font-medium">
                  Email Preview (with sample data: firstName="John")
                </div>
                <iframe
                  srcDoc={getPreviewHtml()}
                  className="w-full h-[600px] border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <CodeMirror
                  value={template.html}
                  height="600px"
                  extensions={[html()]}
                  theme={oneDark}
                  onChange={(value) =>
                    setTemplate({ ...template, html: value })
                  }
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                  }}
                />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div>
            <label
              htmlFor="text"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Plain Text Content (Fallback)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Use <code className="text-emerald-400">{'${firstName}'}</code>, <code className="text-emerald-400">{'${appUrl}'}</code>, and <code className="text-emerald-400">{'${year}'}</code> as template variables
            </p>
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <CodeMirror
                value={template.text}
                height="400px"
                theme={oneDark}
                onChange={(value) =>
                  setTemplate({ ...template, text: value })
                }
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  dropCursor: false,
                  allowMultipleSelections: false,
                  indentOnInput: true,
                }}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-800">
            {success && (
              <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

