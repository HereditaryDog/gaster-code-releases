import { clearCommandsCache } from '../../commands.js'
import type { CuratedCapabilityKind } from '../../capabilities/curatedCatalog.js'
import {
  getCuratedCapabilityState,
  setCuratedCapabilityEnabled,
} from '../../capabilities/curatedState.js'
import { clearAgentDefinitionsCache } from '../../tools/AgentTool/loadAgentsDir.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

export async function handleCapabilitiesApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const sub = segments[2]
    if (sub !== 'curated') {
      throw ApiError.notFound(`Unknown capabilities endpoint: ${sub}`)
    }

    if (req.method === 'GET' && segments.length === 3) {
      return Response.json(await getCuratedCapabilityState())
    }

    if (req.method === 'PUT' && segments.length === 5) {
      const kind = parseKind(segments[3])
      const id = decodeURIComponent(segments[4]!)
      const body = await parseJsonBody(req)
      if (typeof body.enabled !== 'boolean') {
        throw ApiError.badRequest('Missing or invalid "enabled" in request body')
      }

      let item
      try {
        item = await setCuratedCapabilityEnabled(kind, id, body.enabled)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Unknown curated')) {
          throw ApiError.notFound(error.message)
        }
        throw error
      }

      clearCommandsCache()
      clearAgentDefinitionsCache()
      const state = await getCuratedCapabilityState()
      return Response.json({
        ok: true,
        item,
        counts: {
          skills: state.skills.filter(skill => skill.enabled).length,
          agents: state.agents.filter(agent => agent.enabled).length,
        },
      })
    }

    throw new ApiError(
      405,
      `Method ${req.method} not allowed on /api/capabilities/curated`,
      'METHOD_NOT_ALLOWED',
    )
  } catch (error) {
    return errorResponse(error)
  }
}

function parseKind(raw: string | undefined): CuratedCapabilityKind {
  if (raw === 'skills' || raw === 'agents') return raw
  throw ApiError.badRequest(`Unsupported curated capability kind: ${raw ?? ''}`)
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }
}
