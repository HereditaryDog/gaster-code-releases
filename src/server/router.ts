/**
 * API Router — 将请求路由到对应的 API handler
 */

import { handleSessionsApi } from './api/sessions.js'
import { handleSettingsApi } from './api/settings.js'
import { handleModelsApi } from './api/models.js'
import { handleScheduledTasksApi } from './api/scheduled-tasks.js'
import { handleSearchApi } from './api/search.js'
import { handleAgentsApi } from './api/agents.js'
import { handleStatusApi } from './api/status.js'
import { handleConversationsApi } from './api/conversations.js'
import { handleTeamsApi } from './api/teams.js'
import { handleFilesystemRoute } from './api/filesystem.js'
import { handleProvidersApi } from './api/providers.js'
import { handleAdaptersApi } from './api/adapters.js'
import { handlePluginsApi } from './api/plugins.js'
import { handleSkillsApi } from './api/skills.js'
import { handleCapabilitiesApi } from './api/capabilities.js'
import { handleComputerUseApi } from './api/computer-use.js'
import { handleGasterOAuthApi } from './api/gaster-oauth.js'
import { handleGMasterAuthApi } from './api/gmaster-auth.js'
import { handleGasterOpenAIOAuthApi } from './api/gaster-openai-oauth.js'
import { handleMcpApi } from './api/mcp.js'
import { handleDiagnosticsApi } from './api/diagnostics.js'
import { handleDoctorApi } from './api/doctor.js'
import { handleImagesApi } from './api/images.js'
import { handleH5AccessApi } from './api/h5-access.js'
import { handleActivityStatsApi } from './api/activityStats.js'
import { handleMemoryApi } from './api/memory.js'
import { handleOpenTargetsApi } from './api/open-targets.js'

export async function handleApiRequest(req: Request, url: URL): Promise<Response> {
  const path = url.pathname
  const segments = path.split('/').filter(Boolean) // ['api', 'sessions', ...]

  // Route to appropriate handler based on the second segment
  const resource = segments[1]

  switch (resource) {
    case 'sessions': {
      // Route /api/sessions/:id/chat/* to conversations handler
      const subResource = segments[3]
      if (subResource === 'chat') {
        return handleConversationsApi(req, url, segments)
      }
      return handleSessionsApi(req, url, segments)
    }

    case 'conversations':
      return handleConversationsApi(req, url, segments)

    case 'settings':
      return handleSettingsApi(req, url, segments)

    case 'models':
    case 'effort':
      return handleModelsApi(req, url, segments)

    case 'permissions':
      return handleSettingsApi(req, url, segments) // permissions under settings

    case 'scheduled-tasks':
      return handleScheduledTasksApi(req, url, segments)

    case 'search':
      return handleSearchApi(req, url, segments)

    case 'agents':
    case 'tasks':
      return handleAgentsApi(req, url, segments)

    case 'status':
      return handleStatusApi(req, url, segments)

    case 'teams':
      return handleTeamsApi(req, url, segments)

    case 'providers':
      return handleProvidersApi(req, url, segments)

    case 'gaster-oauth':
      return handleGasterOAuthApi(req, url, segments)

    case 'gmaster-auth':
      return handleGMasterAuthApi(req, url, segments)

    case 'gaster-openai-oauth':
      return handleGasterOpenAIOAuthApi(req, url, segments)

    case 'adapters':
      return handleAdaptersApi(req, url, segments)

    case 'skills':
      return handleSkillsApi(req, url, segments)

    case 'capabilities':
      return handleCapabilitiesApi(req, url, segments)

    case 'mcp':
      return handleMcpApi(req, url, segments)

    case 'plugins':
      return handlePluginsApi(req, url, segments)

    case 'computer-use':
      return handleComputerUseApi(req, url, segments)

    case 'diagnostics':
      return handleDiagnosticsApi(req, url, segments)

    case 'doctor':
      return handleDoctorApi(req, url, segments)

    case 'images':
      return handleImagesApi(req, url, segments)

    case 'h5-access':
      return handleH5AccessApi(req, url, segments)

    case 'activity-stats':
      return handleActivityStatsApi(req, url, segments)

    case 'memory':
      return handleMemoryApi(req, url, segments)

    case 'open-targets':
      return handleOpenTargetsApi(req, url, segments)

    case 'filesystem':
      return handleFilesystemRoute(url.pathname, url)

    default:
      return Response.json(
        { error: 'Not Found', message: `Unknown API resource: ${resource}` },
        { status: 404 }
      )
  }
}
