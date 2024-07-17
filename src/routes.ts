import dayjs from "dayjs"
import { prisma } from "./lib/prisma"
import { FastifyInstance } from "fastify"
import {z} from 'zod'

export async function appRoutes(app : FastifyInstance){
    app.post('/habits', async (request) =>{
        //title, weekdays
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(z.number().min(0).max(6))
            //[0,1,2] => Dom, seg, ter
        })

        const { title, weekDays } = createHabitBody.parse(request.body)

        //startof zera as horas 
        const today = dayjs().startOf('day').toDate()

        await prisma.habit.create({
            data:{
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay,
                        }
                    })
                }
            }
        })
    })

    app.get('/day', async (request) => {
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(request.query)

        const parsedDate = dayjs(date).startOf('day')
        const weekDay = parsedDate.get('day')
        
        //vai retornar 
        // todos os habitos possiveis 
        //habitos que ja foram completados

        const possibleHabits = await prisma.habit.findMany({
            where:{
                created_at:{
                    lte: date,
                },
                weekDays:{
                    some: {
                        week_day: weekDay,
                    }
                }
            }
        })

        const day = await prisma.day.findUnique({
            where:{
                date: parsedDate.toDate(),
            },
            include:{
                dayHabits: true
            }

        })

        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id
        })

        return {
            possibleHabits,
            completedHabits
        }
    })
}

