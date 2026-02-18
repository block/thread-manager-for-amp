import type { IncomingMessage, ServerResponse } from 'http';
import { jsonResponse, parseBody } from '../lib/utils.js';
import {
  getArtifacts,
  getArtifact,
  createArtifact,
  updateArtifact,
  deleteArtifact,
} from '../lib/database.js';
import { join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import type { Artifact, ArtifactType } from '../../shared/types.js';
import { ARTIFACTS_DIR } from '../lib/threadTypes.js';

mkdir(ARTIFACTS_DIR, { recursive: true }).catch(() => {});

interface CreateArtifactBody {
  threadId: string;
  type: ArtifactType;
  title: string;
  content?: string;
  mediaType?: string;
}

interface UpdateArtifactBody {
  id: number;
  title?: string;
  content?: string;
}

interface DeleteArtifactBody {
  id: number;
}

export async function handleArtifactRoutes(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/artifacts' && req.method === 'GET') {
    const threadId = url.searchParams.get('threadId');
    if (!threadId) {
      return jsonResponse(res, { error: 'threadId required' }, 400);
    }

    const artifacts = getArtifacts(threadId);
    return jsonResponse(res, artifacts);
  }

  if (pathname === '/api/artifact' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) {
      return jsonResponse(res, { error: 'id required' }, 400);
    }

    const artifact = getArtifact(parseInt(id, 10)) as
      | (Artifact & { content?: string | null })
      | undefined;
    if (!artifact) {
      return jsonResponse(res, { error: 'Artifact not found' }, 404);
    }

    if (artifact.file_path && !artifact.content) {
      try {
        const data = await readFile(artifact.file_path);
        if (artifact.type === 'image') {
          artifact.content = data.toString('base64');
        } else {
          artifact.content = data.toString('utf-8');
        }
      } catch {
        // File might not exist
      }
    }

    return jsonResponse(res, artifact);
  }

  if (pathname === '/api/artifacts' && req.method === 'POST') {
    const body = await parseBody<CreateArtifactBody>(req);
    const { threadId, type, title, content, mediaType } = body;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
    if (!threadId || !type || !title) {
      return jsonResponse(res, { error: 'threadId, type, and title required' }, 400);
    }

    let filePath: string | null = null;
    let storedContent: string | null | undefined = content;

    if (type === 'image' && content) {
      const threadDir = join(ARTIFACTS_DIR, threadId);
      await mkdir(threadDir, { recursive: true });

      const ext = mediaType?.split('/')[1] || 'png';
      const filename = `${Date.now()}.${ext}`;
      filePath = join(threadDir, filename);

      const buffer = Buffer.from(content, 'base64');
      await writeFile(filePath, buffer);
      storedContent = null;
    }

    const artifact = createArtifact({
      threadId,
      type,
      title,
      content: storedContent ?? null,
      filePath,
      mediaType: mediaType ?? null,
    });

    return jsonResponse(res, artifact, 201);
  }

  if (pathname === '/api/artifact' && req.method === 'PATCH') {
    const body = await parseBody<UpdateArtifactBody>(req);
    const { id, title, content } = body;

    if (!id) {
      return jsonResponse(res, { error: 'id required' }, 400);
    }

    const artifact = updateArtifact(parseInt(String(id), 10), { title, content });
    return jsonResponse(res, artifact);
  }

  if (pathname === '/api/artifact' && req.method === 'DELETE') {
    const body = await parseBody<DeleteArtifactBody>(req);
    const { id } = body;

    if (!id) {
      return jsonResponse(res, { error: 'id required' }, 400);
    }

    const artifact = deleteArtifact(parseInt(String(id), 10));

    if (artifact?.file_path) {
      await unlink(artifact.file_path).catch(() => {});
    }

    return jsonResponse(res, { success: true });
  }

  return false;
}
