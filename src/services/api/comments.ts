import { projectId } from "../../utils/supabase/info";
import { Comment } from "../../types/scheduler";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528`;

export async function fetchComments(workspaceId: string, accessToken: string): Promise<Comment[]> {
  const response = await fetch(`${BASE_URL}/comments?workspace_id=${workspaceId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`❌ API Error fetching comments:`, errorData);
    throw new Error(errorData.error || 'Failed to fetch comments');
  }

  return response.json();
}

export async function createComment(
  commentData: {
    workspaceId: string;
    userId: string;       // resourceId with 'r' prefix
    comment: string;
    weekDate: string;
    weekIndex?: number;
  },
  accessToken: string
): Promise<Comment> {
  const response = await fetch(`${BASE_URL}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(commentData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`❌ API Error creating comment:`, errorData);
    throw new Error(errorData.error || 'Failed to create comment');
  }

  return response.json();
}

export async function updateComment(
  commentId: string,
  workspaceId: string,
  text: string | undefined,
  weekIndex: number | undefined,
  userId: string | undefined,
  accessToken: string
): Promise<Comment> {
  const response = await fetch(`${BASE_URL}/comments/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ comment: text, workspaceId, weekIndex, userId })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update comment');
  }

  return response.json();
}

export async function deleteComment(
  commentId: string,
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`${BASE_URL}/comments/${commentId}?workspace_id=${workspaceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete comment');
  }
}