/**
 * Created by root on 8/2/17.
 */
import _ from 'underscore'

export function serializeObject (obj) {
  if (_.isFunction(obj)) {
    return obj.toString()
  }

  obj = Object.assign({}, obj)
  _.each(obj, (value, key) => {
    if (value instanceof RegExp) {
      obj[key] = {
        type: 'RegExp',
        value: value.source
      }
    }
  })
  return obj
}

export function deserializeObject (obj) {
  if (typeof obj === 'string' && obj.indexOf('function') !== -1) {
    return new Function(`return ${obj}`)()
  }

  obj = Object.assign({}, obj)
  _.each(obj, (value, key) => {
    if (typeof value === 'object' && value.type === 'RegExp') {
      obj[key] = new RegExp(value.value)
    }
  })
  return obj
}

export function publishPredicateBuilder (publishEvent, publishService) {
  return (options) => {
    if (!options.subscribed || !options.subscribed[publishEvent]) return false

    let subscribedEventServices = options.subscribed[publishEvent]

    return subscribedEventServices === '*' || subscribedEventServices.indexOf(publishService) !== -1
  }
}

export function randomWithProbablilities (array, probabilities) {
  let sum = 0
  let random = Math.random()

  let remaining = 1

  _.each(probabilities, (prob) => {
    remaining -= prob
  })

  probabilities.push(remaining)

  return _.find(array, (elem, index) => {
    sum += probabilities[index]
    if (random <= sum) {
      return true
    }
  })
}
