const MongoClient = require('mongodb').MongoClient;

async function connect(mongoUri, databaseName) {
    const client = await MongoClient.connect(mongoUri,{
        useUnifiedTopology: true
    })

    const db = client.db(databaseName);
    return db;
}

module.exports = {connect};