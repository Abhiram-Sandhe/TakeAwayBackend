import express from 'express'
import { registerController, loginController } from '../controller/registerController.js'
//router object

const router = express.Router()

//routing
//register
router.post('/register', registerController)

//login
router.post('/login', loginController)

export default router;