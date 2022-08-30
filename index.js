const express = require ('express')
const cors = require ('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const hbs = require('hbs');
const wax = require('wax-on');

console.log(process.env);

const mongoUtil = require('./MongoUtil');
const { ObjectID } = require('bson');

const app = express();


app.use(express.json())
app.use(cors());
app.set('view engine', 'hbs');

app.use(express.urlencoded({
    'extended': false
}))

 wax.on(hbs.handlebars);
 wax.setLayoutPath('./views/layouts')

app.use(express.urlencoded({extended:false}));

 hbs.handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});



const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const TOKEN_SECRET = process.env.TOKEN_SECRET;

function generateAccessToken(id, email) {
    return jwt.sign({
        'id':id,
        'email': email
     }, TOKEN_SECRET, {
        'expiresIn': '3hr'
    })
}

function checkIfAuthenticatedJWT(req, res, next){
    if (req.headers.authorization) {
        const headers = req.headers.authorization;
        const token = headers.split(" ")[1];

        jwt.verify(token, TOKEN_SECRET, function (err, tokenData) {
            if (err) {
                res.status(403);
                res.json({
                    'error': "Your access token is invalid"
                })
                return;
            }
            req.user = tokenData;

            next();

        })

    } else {
        res.status(403);
        res.json({
            'error': "You must provide an access token to access this route"
        })
    }

}


async function main (){
    const db = await mongoUtil.connect(MONGO_URI, DB_NAME);
   
   

    app.get('/', function(req,res){
        res.json({
           'message':'I love candies and cupcakes'
        });
       })

    app.get('/reviews', async function(req,res){
       
        try {

        let criteria = {};

        if(req.query.restaurant) {
            criteria.restaurant = {
                '$regex': req.query.restaurant,
                '$options': 'i'
            }
        }

        if (req.query.min_ratings) {
            criteria.ratings = {
                '$gte': parseInt(req.query.min_ratings)
            }
        }


        const reviews = await db.collection('reviews').find(criteria, {
            'projection': {
                '_id': 1,
                'restaurant': 1,
                'title': 1,
                'cuisine': 1,
                'review': 1,
                'ratings': 1
            }
        }).toArray();
        res.json(reviews);
    } catch (e) {
        console.log(e);
        res.status(500);
        res.json({
            'error': "Internal server error"
        })
    }

    })



    app.post('/reviews', async function(req,res){
        const results = await db.collection('reviews').insertOne({
            "restaurant": req.body.restaurant,
            "title": req.body.title,
            "cuisine": req.body.cuisine,
            "review": req.body.review,
            "ratings": req.body.ratings
            
        })
        res.json({
            'message':'New review created successfully',
            'results': results
        })
    })
    
    app.put('/reviews/:reviewId', async function(req,res){

        const review = await db.collection('reviews').findOne({
            '_id': ObjectID(req.params.reviewId)
        })

        const results = await db.collection('reviews').updateOne({
            '_id': ObjectID(req.params.reviewId)
            },{
                "$set":{
                    'restaurant': req.body.restaurant ? req.body.restaurant : review.restaurant,
                    'title': req.body.title ? req.body.title : review.title,
                    'cuisine': req.body.cuisine ? req.body.cuisine : review.cuisine,
                    'review': req.body.review ? req.body.review : review.review,
                    'ratings': req.body.ratings ? req.body.ratings : review.ratings,
                }
        })

        
        res.json({
            'message':'Review updated',
            'results': results
        })
    })

    app.delete('/reviews/:reviewId', async function (req, res) {
        await db.collection('reviews').deleteOne({
            '_id': ObjectID(req.params.reviewId)
        })
        res.json({
            'message': "Review deleted successfully"
        })
    })

    app.post('/reviews/:reviewId/comments', async function(req,res){
        const results = await db.collection('reviews').updateOne({
            _id: ObjectID(req.params.reviewId)
        },{
            '$push':{
                'comments':{
                    '_id': ObjectID(),
                    'content': req.body.content,
                    'nickname': req.body.nickname
                }
            }
        })

        res.json({
            'message': 'Comment has been added successfully',
            'results': results
        })
    })

    app.get('/reviews/:reviewId', async function(req,res){
        const review = await db.collection('reviews').findOne({
            _id:ObjectID(req.params.reviewId)
        });
        res.json(review);
    })

    app.put('/comments/:commentId/update', async function(req,res){
        const results = await db.collection('reviews').updateOne({
            'comments._id':ObjectID(req.params.commentId)
        },{
            '$set': {
                'comments.$.content': req.body.content,
                'comments.$.nickname': req.body.nickname
            }
        })
        res.json({
            'message': 'Comment updated',
            'results': results
        })
    })
    app.delete('/comments/:commentId', async function(req,res){
        const results = await db.collection('reviews').updateOne({
            'comments._id': ObjectID(req.params.commentId)
        }, {
            '$pull': {
                'comments': {
                    '_id': ObjectID(req.params.commentId)
                }
            }
        })
        res.json({
            'message': 'Comment deleted',
            'result': results
        })
    })

    app.post('/users', async function (req, res) {
        const results = await db.collection('users').insertOne({
            "email": req.body.email,
            "password": req.body.password
        });

        res.json({
            'message': 'User has been created',
            'results': results
        })
    })

    app.post('/login', async function(req,res){
        const user = await db.collection('users').findOne({
            'email': req.body.email,
            'password': req.body.password
        });
        
        if (user) {
            let token = generateAccessToken(user._id, user.email);
            res.json({
                'accessToken': token
            })
        } else {
            res.status(401);
            res.json({
                'message': 'Invalid email or password'
            })
        }
    })

    app.get('/user/:userId', [checkIfAuthenticatedJWT], async function (req, res) {

        res.json({
            'email': req.user.email,
            'id': req.user.id,
            'message': 'You are viewing your profile'
        })



    })
}

main();


app.listen(3000, function(){
    console.log("server has started")
})