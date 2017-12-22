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

export function publishPredicateBuilder (event) {
  return (options) => options.subscribed && options.subscribed.indexOf(event) !== -1
}
