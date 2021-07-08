import { Dispatch } from 'redux'
import { Socket } from 'socket.io-client'
import axios from 'axios'
import message from 'antd/lib/message'

import {
  addAppointedDate,
  removeAppointment,
  setAppointedDates,
  setAppointments,
  setAppointmentsLoading,
  updateAppointment
} from '../store/actions/appointments'

import catchError from '../utils/catchError'

import { AppointmentsAction, IShortAppointment } from '../types/appointments'
import { SocketActions } from '../types'

export const fetchAppointments = () => (dispatch: Dispatch<AppointmentsAction>) => {
  dispatch(setAppointmentsLoading(true))
  axios.get('/api/appointments')
    .then(({ data }) => dispatch(setAppointments(data.appointments)))
    .catch(catchError)
    .finally(() => dispatch(setAppointmentsLoading(false)))
}

export const fetchAppointedDates = (serviceId: string) => (dispatch: Dispatch<AppointmentsAction>) => {
  axios.get(`api/appointments/appointed-dates/${serviceId}`)
    .then(({ data }) => dispatch(setAppointedDates(data.appointedDates)))
    .catch(catchError)
}

export const fetchCreateAppointment = (data: IShortAppointment, hospitalId: string, socket: Socket) => (dispatch: Dispatch<AppointmentsAction>) => {
  axios.post('/api/appointments', data)
    .then(({ data }) => {
      message.success(data.message)
      dispatch(addAppointedDate(data.appointment.date))
      socket.emit(SocketActions.Appoint, { hospitalId, data: data.appointment })
    })
    .catch(catchError)
}

export const fetchRemoveAppointment = (id: string) => (dispatch: Dispatch<AppointmentsAction>) => {
  axios.delete(`/api/appointments/${id}`)
    .then(({ data }) => {
      message.success(data.message)
      dispatch(removeAppointment(id))
    })
    .catch(catchError)
}

export const fetchUpdateAppointment = (id: string, data: IShortAppointment) => (dispatch: Dispatch<AppointmentsAction>) => {
  axios.put(`/api/appointments/${id}`, data)
    .then(({ data }) => {
      message.success(data.message)
      dispatch(updateAppointment(data.appointment))
    })
    .catch(catchError)
}

export const fetchCreateAppointDate = (serviceId: string, date: Date, cb: () => void) => {
  axios.post(`/api/appointed-dates/${serviceId}`, { date })
    .then(({ data }) => {
      message.success(data.message)
      cb()
    })
    .catch(catchError)
}