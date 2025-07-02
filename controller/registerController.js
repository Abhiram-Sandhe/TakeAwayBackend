import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import userModel from "../models/userModel.js";
import JWT from 'jsonwebtoken';
export const registerController = async(req, res)=>{
    try{
        const {name, email, password, phone} = req.body;
        //validation
        if(!name){
            return res.send({error:'Name is Required'})
        }
        if(!email){
            return res.send({error:'Email is Required'})
        }
        if(!password){
            return res.send({error:'Password is Required'})
        }
        if(!phone){
            return res.send({error:'Phone is Required'})
        }

        const existingUser= await userModel.findOne({email})
        if(existingUser){
            return res.status(200).send({
                success:true,
                message:'User Already exits! Please Login',
            })
        }
        //register user
        const hashedPassword = await hashPassword(password)
        const user = await new userModel({name, email, phone,password:hashedPassword}).save();
        res.status(201).send({
            success:true,
            message:"User Register Succesfully",
            user,
        });
    }catch(error){
        console.log(error)
        res.status(500).send({
            success:false,
            message:'Error in Registration',
            error
        })
    }
};


export const loginController = async (req, res)=>{
    try{
        const {email, password} = req.body
        if(!email || !password){
            return res.status(404).send({
                success:false,
                message:'Invalid email or password'
            })
        }
        //check user
        const user  = await userModel.findOne({email})
        if(!user){
            return res.status(404).send({
                success:false,
                message:'Email not registered'
            })
        }
        const match = await comparePassword(password, user.password)
        if(!match){
            return res.status(200).send({
                success:false,
                message:'Invalid Password'
            })
        }

        const token = await JWT.sign({_id:user._id}, process.env.JWT_SECRET, {expiresIn: "7d"});

        res.status(200).send({
            success:true,
            message:'Login sucessfull',
            user:{
                name:user.name,
                email:user.email,
                phone:user.phone,
                role:user.role
            },
            token,
        })

    }catch(error){
        console.log(error)
        res.status(500).send({
            success:false,
            message:'Error in Login',
            error
        })
    }
}