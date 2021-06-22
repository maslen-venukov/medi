import { Request, Response } from 'express'

import Service, { IService } from '../models/Service'
import Category from '../models/Category'
import Hospital from '../models/Hospital'
import User, { IUserRequest } from '../models/User'

import errorHandler from '../utils/errorHandler'
import createError from '../utils/createError'
import isValidObjectId from '../utils/isValidObjectId'

import { HTTPStatusCodes, Roles } from '../types'

type NameFilter = RegExp | null

type CategoryFilter = string | null

interface IPriceFilter {
  $gte?: number
  $lte?: number
}

type PriceFilter = IPriceFilter | null

interface IFilters {
  name?: RegExp
  price?: IPriceFilter
  category?: CategoryFilter
}

interface ISort {
  _id?: string
  price?: string
}

class Controller {
  async create(req: IUserRequest, res: Response): Promise<Response> {
    try {
      const { name, price, category: categoryId } = req.body
      if(!name || !price || !categoryId) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Заполните все поля')
      }

      const category = await Category.findById(categoryId)
      if(!category) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Категория не найдена')
      }

      const hospital = await Hospital.findOne({ user: req.user._id })

      const service = await Service.create({
        name,
        price,
        category,
        hospital: hospital._id
      })

      const result = { ...service._doc, category: category.name }

      return res.json({ message: 'Услуга успешно добавлена', service: result })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }

  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const { q, cat, minp, maxp, p } = req.query

      let name: NameFilter = null
      if(q && typeof q === 'string') {
        name = new RegExp(q, 'gi')
      }

      let category: CategoryFilter = null
      if(cat && typeof cat === 'string') {
        const obj = await Category.findOne({ name: cat })
        category = obj?._id || null
      }

      let price: PriceFilter = null
      if(minp) price = { ...price, $gte: Number(minp)}
      if(maxp) price = { ...price, $lte: Number(maxp)}

      let sort: ISort = { _id: 'desc' }
      if(p && typeof p === 'string') {
        sort = { price: p }
      }

      const filters = { name, category, price }
      const find: IFilters = Object.keys(filters).reduce((acc, key) => {
        const value = filters[key]
        if(value) return { ...acc, [key]: value }
        return acc
      }, {})

      const services: IService[] = await Service.find(find).sort(sort)

      const hospitalIds = [...new Set(services.map(service => service.hospital.toString()))]
      const hospitals = await Hospital.find({ _id: hospitalIds })

      const result = services.map(service => {
        const hospital = hospitals.find(hospital => hospital._id.toString() === service.hospital.toString())
        const { name, address, phone } = hospital
        return {
          ...service._doc,
          hospital: {
            name,
            address,
            phone
          }
        }
      })

      return res.json({ services: result })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      if(!isValidObjectId(id)) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Некорректный ID')
      }

      const service = await Service.findById(id)
      if(!service) {
        return errorHandler(res, HTTPStatusCodes.NotFound, 'Услуга не найдена')
      }

      const category = await Category.findById(service.category)
      const hospital = await Hospital.findById(service.hospital)

      const serviceList = hospital.serviceList.find(list => list.category.toString() === category._id.toString())
      const schedule = serviceList?.schedule || { weekdays: hospital.schedule }

      const result = {
        ...service._doc,
        category: category.name,
        schedule,
        hospital: {
          name: hospital.name,
          address: hospital.address,
          phone: hospital.phone,
          schedule: hospital.schedule
        }
      }

      return res.json({ service: result })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }

  async getByHospital(req: IUserRequest, res: Response): Promise<Response> {
    try {
      const hospital = await Hospital.findOne({ user: req.user._id })

      const services = await Service.find({ hospital: hospital._id }).sort({ _id: -1 })

      const categoriesIds = [...new Set(services.map(service => service.category.toString()))].filter(id => id)
      const categories = await Category.find({ _id: categoriesIds })

      const result = services.map(service => {
        return {
          ...service._doc,
          category: categories.find(category => category._id.toString() === service.category.toString()).name
        }
      })

      return res.json({ services: result })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }

  async remove(req: IUserRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      if(!isValidObjectId(id)) {
        return errorHandler(res, HTTPStatusCodes.BadRequest, 'Некорректный ID')
      }

      const hospital = await Hospital.findOne({ user: req.user._id })

      const service = await Service.findOneAndDelete({ _id: id, hospital: hospital._id })
      if(!service) {
        return errorHandler(res, HTTPStatusCodes.NotFound, 'Услуга не найдена')
      }

      return res.json({ message: 'Услуга успешно удалена' })
    } catch (e) {
      console.log(e)
      await createError(e)
      return errorHandler(res)
    }
  }
}

export default new Controller()