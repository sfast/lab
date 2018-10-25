/**
 * Created by root on 8/2/17.
 */
import _ from 'underscore'


export function publishPredicateBuilder (publishEvent, publishService) {
  return (options) => {
    if (!options.subscribed || !options.subscribed[publishEvent]) return false

    let subscribedEventServices = options.subscribed[publishEvent]

    return subscribedEventServices === '*' || subscribedEventServices.indexOf(publishService) !== -1
  }
}

export function randomWithProbablilities (array, probabilities) {
  let sum = 0

  let remaining = 1
  let newArray = [], newProbs = []
  let unused = 0

  _.each(probabilities, (prob) => {
    remaining -= prob
  })
  probabilities.push(remaining)

  _.each(array, (elem, index) => {
    if (!elem.length) {
      unused += probabilities[index]
      return
    }
    newArray.push(elem)
    newProbs.push(probabilities[index])
  })

  let random = Math.random() * (1 - unused)

  return _.find(newArray, (elem, index) => {
    sum += newProbs[index]
    if (random <= sum) {
      return true
    }
  })
}
