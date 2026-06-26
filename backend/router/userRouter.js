const express = require('express');
const router = express.Router();
const db =  require('../config/firebaseConfig');

// register user
router.post('/register', async(req, res) => {
    try{
        const{name, email, password} = req.body;
        //check email existence
        const usersRef = db.ref('users');
        const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
        if(snapshot.exists()){
            return res.status(400).json({success: false, message: "email has been registered."});
        }
        // new user
        const newUserRef = usersRef.push();
        await newUserRef.set({
            name, email, password, // bcrypt pw
            createdAt: new Date().toISOString()
        });
        res.json({success: true, userId: newUserRef.key, message: "registered successfully."});
    } catch(error) {
        res.status(500).json({success: false, error: error.message});
    }
});

router.post('/login', async(req, res) => {
    try{
        const{email, password} = req.body;
        const usersRef = db.ref('users');
        const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
        if(!snapshot.exists()){
            return res.status(400).json({success: false, message: "user not found."});
        }
        let userFound = null;
        let userId = null;
        snapshot.forEach(child => {
            const user = child.val();
            if(user.password == password){
                userFound = user;
                userId = child.key;
            }
        });
        if(!userFound){
            return res.status(401).json({success: false, message: "wrong password."});
        }
        res.json({success: true, message: "login successfully.",
            data: {userId, name: userFound.name, email: userFound.email}
        });
    } catch(error){
        res.status(500).json({success: false, error: error.message});
    }
});

module.exports = router;