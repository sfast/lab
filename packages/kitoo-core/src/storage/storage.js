/**
 * Created by root on 7/18/17.
 */
import Loki from 'lokijs'

import * as collections from './collections'

export default class Storage {
  constructor (dbInstance, dbPath) {
    this.db = dbInstance || new Loki(dbPath || './db/kitoo.json')
    this.createCollection(collections.NETWORKS)
    this.createCollection(collections.ROUTERS)
  }

  setDb (dbInstance) {
    this.db = dbInstance
  }

  async find (collectionName, query) {
    let collection = this.getCollection(collectionName)
    if (!collection) {
      throw `there is no collection with that name ${collectionName}`
    }
    return collection.find(query)
  }

  async findOne (collectionName, query) {
    let collection = this.getCollection(collectionName)
    if (!collection) {
      throw `there is no collection with that name ${collectionName}`
    }
    return collection.findOne(query)
  }

  async insert (collectionName, row) {
    let collection = this.getCollection(collectionName)
    if (!collection) {
      throw `there is no collection with that name ${collectionName}`
    }
    return collection.insert(row)
  }

  async update (collectionName, row) {
    let collection = this.getCollection(collectionName)
    if (!collection) {
      throw `there is no collection with that name ${collectionName}`
    }
    return collection.update(row)
  }

  async remove (collectionName, row) {
    let collection = this.getCollection(collectionName)
    if (!collection) {
      throw `there is no collection with that name ${collectionName}`
    }
    return collection.remove(row)
  }

  createCollection (name, options) {
    this.db.addCollection(name, options)
  }

  getCollection (collectionName) {
    return this.db.getCollection(collectionName)
  }
}
