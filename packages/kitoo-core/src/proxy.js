import { ErrorCodes } from 'zeronode'

import { serializeObject } from './utils'
import { Events } from './events'
import { KitooCoreError, KitooCoreErrorCodes } from './errors'

const proxyTick = function ({ id, event, type, data, filter, routerFilter } = {}) {
  try {
    let requestObject = {
      event: Events.ROUTER.MESSAGE,
      data: {
        id,
        type,
        event,
        data,
        filter: filter ? serializeObject(filter) : undefined
      },
      filter: routerFilter
    }

    return this.tickAny(requestObject)
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

const proxyRequest = async function ({ id, event, type, data, timeout, filter, routerFilter } = {}) {
  try {
    let requestObject = {
      event: Events.ROUTER.MESSAGE,
      data: {
        id,
        type,
        event,
        data,
        timeout,
        filter: filter ? serializeObject(filter) : undefined
      },
      timeout,
      filter: routerFilter
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
