import { ErrorCodes } from 'zeronode'

import { serializeObject } from './utils'
import { KitooCoreError, KitooCoreErrorCodes } from './errors'
import Globals from './globals'

const { EVENTS } = Globals

const proxyTick = function ({ id, event, type, data, filter } = {}) {
  try {
    let requestObject = {
      event: EVENTS.ROUTER.MESSAGE,
      data: {
        id,
        type,
        event,
        data,
        filter: filter ? serializeObject(filter) : undefined
      }
    }

    return this.ticktAny(requestObject)
  } catch (err) {
    let kitooErr = new KitooCoreError()

    if (err.code === ErrorCodes.NODE_NOT_FOUND) {
      let noRouterAvailable = new Error(`There is no router available for service '${this.getId()}'`)
      kitooErr.error = noRouterAvailable
      kitooErr.code = KitooCoreErrorCodes.NO_ONLINE_ROUTER
    }

    kitooErr.error = err

    throw kitooErr
  }
}

const proxyRequest = async function ({ id, event, type, data, timeout, filter } = {}) {
  try {
    let requestObject = {
      event: EVENTS.ROUTER.MESSAGE,
      data: {
        id,
        type,
        event,
        data,
        timeout,
        filter: filter ? serializeObject(filter) : undefined
      },
      timeout,
      filter: {serviceName: 'KitooCoreRouter'}
    }

    return await this.requestAny(requestObject)
  } catch (err) {
    let kitooErr = new KitooCoreError()

    if (err.code === ErrorCodes.NODE_NOT_FOUND) {
      let noRouterAvailable = new Error(`There is no router available for service '${this.getId()}'`)
      kitooErr.error = noRouterAvailable
      kitooErr.code = KitooCoreErrorCodes.NO_ONLINE_ROUTER
    }

    kitooErr.error = err

    throw kitooErr
  }
}

export { proxyTick, proxyRequest }

export default { proxyTick, proxyRequest }
