import { ErrorCodes } from 'zeronode'
import _ from 'lodash'

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
        data
      },
      filter: routerFilter
    }

    let services = []
    if (filter) {
      services = this::checkFilter(filter, true)
      if (!services) return
    }

    requestObject.data.filter = { _id: { $in: services } }

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
        timeout
      },
      timeout,
      filter: routerFilter
    }

    let services = []
    if (filter) services = this::checkFilter(filter, true)

    requestObject.data.filter = { _id: { $in: services }}

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

const optionsPredicateBuilder = (options) => {
  return (nodeOptions) => {
    let optionsKeysArray = Object.keys(options)
    let notsatisfying = _.find(optionsKeysArray, (optionKey) => {
      let optionValue = options[optionKey]
      // ** which could also not exist
      let nodeOptionValue = nodeOptions[optionKey]

      if (nodeOptionValue) {
        if (_.isFunction(optionValue)) {
          return !optionValue(nodeOptionValue)
        }

        if (_.isRegExp(optionValue)) {
          return !optionValue.test(nodeOptionValue)
        }

        if (_.isString(optionValue) || _.isNumber(optionValue)) {
          return optionValue !== nodeOptionValue
        }

        if (_.isObject(optionValue)) {
          return !!_.find(optionValue, (value, operator) => {
            switch (operator) {
              case '$eq':
                return value !== nodeOptionValue
              case '$ne':
                return value === nodeOptionValue
              case '$aeq':
                return value != nodeOptionValue
              case '$gt':
                return value >= nodeOptionValue
              case '$gte':
                return value > nodeOptionValue
              case '$lt':
                return value <= nodeOptionValue
              case '$lte':
                return value < nodeOptionValue
              case '$between':
                return value[0] >= nodeOptionValue || value[1] <= nodeOptionValue
              case '$regex':
                return !value.test(nodeOptionValue)
              case '$in':
                return value.indexOf(nodeOptionValue) === -1
              case '$nin':
                return value.indexOf(nodeOptionValue) !== -1
              case '$contains':
                return nodeOptionValue.indexOf(value) === -1
              case '$containsAny':
                return !_.find(value, (v) => nodeOptionValue.indexOf(v) !== -1)
              case '$containsNone':
                return !!_.find(value, (v) => nodeOptionValue.indexOf(v) !== -1)
            }
          })
        }
      }

      return true
    })

    return !notsatisfying
  }
}

function checkFilter (filter, captureError = false) {
  let optionsPredicate = filter
  if (!_.isFunction(filter)) {
    optionsPredicate = optionsPredicateBuilder(filter)
  }

  let services = []
  this.getFilteredNodes({ predicate: (routerOptions) => {
    _.each(routerOptions.services, (serviceOptions, serviceId) => {
      optionsPredicate(serviceOptions) && services.push(serviceId)
    })
  }})

  if (!services.length) {
    if (!captureError) return false
    throw new Error(`There isn't service satisfying to given filter: ${filter}`)
  }
  return services
}

export { proxyTick, proxyRequest }

export default { proxyTick, proxyRequest }
