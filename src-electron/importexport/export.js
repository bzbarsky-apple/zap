/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/*
 * This file provides the functionality that reads the ZAP data from a database
 * and exports it into a file.
 */
const fs = require('fs')
const env = require('../util/env.js')
const querySession = require('../db/query-session.js')
const queryConfig = require('../db/query-config.js')

/**
 * Resolves to an array of objects that contain 'key' and 'value'
 *
 * @export
 * @param {*} db
 * @param {*} sessionId
 * @returns Promise to retrieve all session key values.
 */
function exportSessionKeyValues(db, sessionId) {
  return queryConfig.getAllSessionKeyValues(db, sessionId)
}

/**
 * Resolves to an array of endpoint types.
 *
 * @export
 * @param {*} db
 * @param {*} sessionId
 * @returns Promise to retrieve all endpoint types.
 */
function exportEndpointTypes(db, sessionId) {
  return queryConfig.getAllEndpointTypes(db, sessionId).then((endpoints) => {
    var promises = []
    endpoints.forEach((endpoint) => {
      promises.push(
        queryConfig.getEndpointTypeClusters(db, endpoint.endpointTypeId).then(
          (clusterRows) =>
            new Promise((resolve, reject) => {
              endpoint.clusters = clusterRows
              clusterRows.forEach((x) => {
                delete x.endpointTypeRef
                delete x.endpointTypeClusterId
              })
              resolve(clusterRows)
            })
        )
      )

      promises.push(
        queryConfig.getEndpointTypeAttributes(db, endpoint.endpointTypeId).then(
          (attributeRows) =>
            new Promise((resolve, reject) => {
              endpoint.attributes = attributeRows
              attributeRows.forEach((x) => {
                delete x.endpointTypeRef
                delete x.endpointTypeAttributeId
              })
              resolve(attributeRows)
            })
        )
      )

      promises.push(
        queryConfig.getEndpointTypeCommands(db, endpoint.endpointTypeId).then(
          (commandRows) =>
            new Promise((resolve, reject) => {
              endpoint.commands = commandRows
              commandRows.forEach((x) => {
                delete x.endpointTypeRef
                delete x.endpointTypeCommandId
              })
              resolve(commandRows)
            })
        )
      )
    })
    return Promise.all(promises).then(() => endpoints)
  })
}

/**
 * Toplevel file that takes a given session ID and exports the data into the file
 *
 * @export
 * @param {*} db
 * @param {*} sessionId
 * @param {*} filePath
 * @returns A promise that resolves with the path of the file written.
 */
function exportDataIntoFile(db, sessionId, filePath) {
  env.logInfo(`Writing state from session ${sessionId} into file ${filePath}`)
  return createStateFromDatabase(db, sessionId)
    .then((state) => {
      env.logInfo(`About to write the file to ${filePath}`)
      env.logInfo(state)
      return new Promise((resolve, reject) => {
        env.logInfo(`Writing the file to ${filePath}`)
        fs.writeFile(filePath, JSON.stringify(state, null, 2), (err) => {
          if (err) reject(err)
          resolve()
        })
      })
    })
    .then(() => {
      return querySession.setSessionClean(db, sessionId)
    })
    .then(() => {
      return Promise.resolve(filePath)
    })
}

/**
 * Given a database and a session id, this method returns a promise that
 * resolves with a state object that needs to be saved into a file.
 *
 * @export
 * @param {*} db
 * @param {*} sessionId
 * @returns state object that needs to be saved into a file.
 */
function createStateFromDatabase(db, sessionId) {
  return new Promise((resolve, reject) => {
    var state = {
      writeTime: new Date().toString(),
      creator: 'zap',
    }
    var promises = []

    env.logInfo(`Exporting data for session: ${sessionId}`)
    // Deal with the key/value table
    var getKeyValues = exportSessionKeyValues(db, sessionId).then((data) => {
      state.keyValuePairs = data
      env.logInfo(`Retrieved session keys: ${data.length}`)
      return Promise.resolve(data)
    })
    promises.push(getKeyValues)

    var getAllEndpointTypes = exportEndpointTypes(db, sessionId).then(
      (data) => {
        env.logInfo(`Retrieved endpoint types: ${data.length}`)
        state.endpointTypes = data
        return Promise.resolve(data)
      }
    )
    promises.push(getAllEndpointTypes)

    return Promise.all(promises)
      .then(() => resolve(state))
      .catch((err) => reject(err))
  })
}
// exports
exports.exportDataIntoFile = exportDataIntoFile
exports.createStateFromDatabase = createStateFromDatabase
