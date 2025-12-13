import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// Security questions list (must match client-side)
const SECURITY_QUESTIONS = [
  { id: 'q1', question: 'What city were you born in?' },
  { id: 'q2', question: 'What is the name of your first pet?' },
  { id: 'q3', question: 'What was the name of your elementary school?' },
  { id: 'q4', question: 'What is your mother\'s maiden name?' },
  { id: 'q5', question: 'What was the make of your first car?' },
  { id: 'q6', question: 'What street did you live on as a child?' },
  { id: 'q7', question: 'What is the name of your childhood best friend?' },
  { id: 'q8', question: 'What was your childhood nickname?' },
  { id: 'q9', question: 'What city did your parents meet in?' },
  { id: 'q10', question: 'What was your favorite teacher\'s last name?' },
  { id: 'q11', question: 'What is your favorite movie?' },
  { id: 'q12', question: 'What is your favorite book?' },
  { id: 'q13', question: 'What is your favorite food?' },
  { id: 'q14', question: 'What is your favorite sports team?' },
  { id: 'q15', question: 'What is your favorite vacation destination?' },
  { id: 'q16', question: 'What year did you graduate high school?' },
  { id: 'q17', question: 'What was the name of your first employer?' },
  { id: 'q18', question: 'What was the name of your first apartment complex?' },
  { id: 'q19', question: 'What was the model of your first phone?' },
  { id: 'q20', question: 'What was the name of your favorite childhood toy?' }
];

const SALT_ROUNDS = 10;

// GET - Fetch security questions for a document (without answers)
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabaseServer
      .from('tools_id_documents')
      .select('id, requires_password_for_download')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.requires_password_for_download) {
      return NextResponse.json({ error: 'Document does not require a password' }, { status: 400 });
    }

    // Fetch security questions
    const { data: securityQuestions, error: sqError } = await supabaseServer
      .from('tools_id_security_questions')
      .select('question_id')
      .eq('document_id', documentId);

    if (sqError || !securityQuestions || securityQuestions.length !== 3) {
      return NextResponse.json({ error: 'Security questions not found' }, { status: 404 });
    }

    // Map question IDs to question text
    const questionsWithText = securityQuestions.map(sq => {
      const question = SECURITY_QUESTIONS.find(q => q.id === sq.question_id);
      return {
        questionId: sq.question_id,
        question: question?.question || 'Unknown question'
      };
    });

    return NextResponse.json({ questions: questionsWithText });
  } catch (error: any) {
    console.error('Error in GET /api/tools/important-documents/reset-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Verify answers and reset password
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, answers, newPassword } = body;

    if (!documentId || !answers || !Array.isArray(answers) || answers.length !== 3) {
      return NextResponse.json({ error: 'Document ID and 3 answers are required' }, { status: 400 });
    }

    // If newPassword is not provided, just verify answers
    const verifyOnly = !newPassword || newPassword.trim().length === 0;

    // Verify document ownership
    const { data: document, error: docError } = await supabaseServer
      .from('tools_id_documents')
      .select('id, requires_password_for_download')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.requires_password_for_download) {
      return NextResponse.json({ error: 'Document does not require a password' }, { status: 400 });
    }

    // Fetch security questions with answer hashes
    const { data: securityQuestions, error: sqError } = await supabaseServer
      .from('tools_id_security_questions')
      .select('question_id, answer_hash')
      .eq('document_id', documentId);

    if (sqError || !securityQuestions || securityQuestions.length !== 3) {
      return NextResponse.json({ error: 'Security questions not found' }, { status: 404 });
    }

    // Verify all answers - match by question_id, not by index
    const answerPromises = answers.map(async (answerObj: { questionId: string; answer: string }) => {
      const securityQuestion = securityQuestions.find(sq => sq.question_id === answerObj.questionId);
      if (!securityQuestion) {
        return false;
      }
      const normalizedAnswer = answerObj.answer.trim().toLowerCase();
      return await bcrypt.compare(normalizedAnswer, securityQuestion.answer_hash);
    });

    const answerResults = await Promise.all(answerPromises);
    const allCorrect = answerResults.every(result => result === true);

    if (!allCorrect) {
      return NextResponse.json({ error: 'One or more answers are incorrect' }, { status: 403 });
    }

    // If verify only, return success without updating password
    if (verifyOnly) {
      return NextResponse.json({ success: true, verified: true, message: 'Answers verified correctly' });
    }

    // All answers correct - update password
    const newPasswordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);

    const { error: updateError } = await supabaseServer
      .from('tools_id_documents')
      .update({ download_password_hash: newPasswordHash })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents/reset-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
