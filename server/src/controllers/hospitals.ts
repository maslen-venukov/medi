import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import User, { IUserRequest } from '../models/User'
import Hospital from '../models/Hospital'
import Category from '../models/Category'
import Service from '../models/Service'
import RegisterLink from '../models/RegisterLink'

import register from '../services/register'

import errorHandler from '../utils/errorHandler'
import createError from '../utils/createError'

import { HTTPStatusCodes, Roles } from '../types'

const SECRET_KEY = process.env.SECRET_KEY
const TOKEN_LIFETIME = process.env.TOKEN_LIFETIME

class Controller {
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password, passwordCheck, name, address, phone, schedule, link } = req.body

      const userData = await register(email, password, passwordCheck)

      const registerError = userData.error

      if(registerError) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, registerError)
      }

      if(!name || !address || !phone || !schedule.start || !schedule.end || !link) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Заполните все поля')
      }

      const existingHospital = await Hospital.findOne().or([{ name }, { address }, { phone }])

      if(existingHospital) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Медицинское учреждение с такими данными уже зарегистрировано')
      }

      const registerLink = await RegisterLink.findOne({ link })

      if(!registerLink) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Недействительный регистрационный номер')
      }

      const role = Roles.Hospital

      const user = await User.create({ ...userData, role })
      const hospital = await Hospital.create({ name, address, phone, schedule, user: user._id.toString() })
      await RegisterLink.deleteOne({ link })

      const data = { _id: user._id, email, role }

      const token = `Bearer ${jwt.sign(data, SECRET_KEY, { expiresIn: TOKEN_LIFETIME })}`

      return res
        .status(HTTPStatusCodes.Created)
        .json({
          token,
          user: data,
          hospital,
          message: 'Регистрация выполнена успешно'
        })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }

  async getAll(req: IUserRequest, res: Response): Promise<Response> {
    try {
      const account = await User.findById(req.user._id)

      if(account.role !== Roles.Admin) {
        return errorHandler(res, HTTPStatusCodes.Forbidden, 'Недостаточно прав')
      }

      const hospitals = await Hospital.find().sort({ _id: -1 })
      const categories = await Category.find()
      const services = await Service.find()

      const result = hospitals.map(hospital => {
        const { _id, name, address, phone, schedule } = hospital
        const serviceList = hospital.serviceList.map(list => {
          const category = categories.find(category => category._id.toString() === list.category.toString())
          const listServices = services.filter(service => service.category.toString() === category._id.toString())
          return {
            category: category.name,
            schedule: list.schedule,
            services: listServices.map(({ _id, name, price }) => ({ _id, name, price }))
          }
        })
        return {
          _id,
          name,
          address,
          phone,
          schedule,
          serviceList
        }
      })

      return res.json({ hospitals: result })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }
}

export default new Controller()