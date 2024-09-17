/** 
* @author Roberto Stefani 
**/ 
let mysql;

const isNode = typeof process !== 'undefined' && process.version;
const isReact = typeof window !== 'undefined' && typeof document !== 'undefined';
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isAngular = typeof window !== 'undefined' && !!window.ng;

if (isNode) {
  mysql = require('mysql');
  console.log('Running in Node.js');
} else if (isReact) {
  console.warn('Running in React (Web): mysql connection not supported!');
} else if (isReactNative) {
  console.log('Running in React Native: mysql connection not supported!');
} else if (isAngular) {
  console.log('Running in Angular: mysql connection not supported!');
} else {
  console.log('Unknown platform: mysql connection not supported!');
}

class MariaDB extends SQLDBConnection {
    async nativeConnect(callback) {
      if (!MariaDB.pool) MariaDB.pool = mysql.createPool({...this, multipleStatements: true});
      const dbConn = this;
      this.connection = this.connection ?? null;
      if (!this.connection) {
        await MariaDB.pool.getConnection((err, conn) => {
          if (err) {
            console.error("Error getting connection:", err);
            return;
          }
          conn.on("end", () => {
            delete dbConn.datasource.sessions[this.sessionId];
          });
          this.connection = conn;
          callback(err);
        });
      }
    }
  
    nativeDisconnect() {
      this.connection.release((releaseError) => {
        if (releaseError) {
          console.error("Error releasing connection:", releaseError);
          return;
        }
        delete this.datasource.sessions[this.sessionId];
      });
    }
  
    startTransaction($name) {
      if (!this.transaction) {
        this.connection.beginTransaction((transactionError) => {
          if (transactionError) {
            throw new Error("Error on starting transaction: " + transactionError);
          }
          this.transaction = $name;
        });
      }
    }
  
    rollback($name) {
      if (this.transaction === $name) {
        this.connection.rollback();
        this.transaction = null;
      }
    }
  
    commit($name) {
      if (this.transaction === $name) {
        this.connection.commit((commitError) => {
          if (commitError) {
            throw new Error(
              'Error on committing transaction "' + $name + '": ' + commitError
            );
          } else this.transaction = null;
        });
      }
    }
  
    async executeNativeQueryAsync(command, params, callback) {
      const date = new Date();
      const response = { executionTime: date.getTime(), executionDateTime: date };
      const connectionHandler = this;
      return new Promise(async (resolve, reject) => {
        if (!connectionHandler.connection)
          await connectionHandler.nativeConnect((err) => {
            if (err) {
              console.error("Errore di connessione:", err);
              reject(err);
              return;
            }
  
            connectionHandler.connection.query(
              command,
              params,
              (error, results, fields) => {
                response.executionTime =
                  new Date().getTime() - response.executionTime;
                response.fields = fields;
                response.results = results;
                response.error = error;
                if (!app.isProduction) {
                  response.query = command;
                  response.params = params;
                }
                callback(response);
                if (error) {
                  reject(response);
                } else {
                  resolve(response);
                }
              }
            );
          });
      });
    }
    executeQuerySync(command, params, callback) {
      const date = new Date();
      const response = { executionTime: date.getTime(), executionDateTime: date };
      const logName = "executeQuerySync_" + response.executionTime;
      asyncConsole.log(logName, "Waiting for query results:");
      let wait = true;
      this.connection.query(command, params, (error, results, fields) => {
        wait = false;
        response.fields = fields;
        response.results = results;
        response.error = error;
        response.executionTime = new Date().getTime() - response.executionTime;
        callback(response);
      });
      while (wait) {
        asyncConsole.log(logName, ".....");
        setTimeout(() => {}, 100);
      }
      return response;
    }
  }
  

  module.exports = {MariaDB};