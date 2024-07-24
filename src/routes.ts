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

    //completar /nao-completar um habito
    app.patch('/habits/:id/toggle', async(request) => {
        //:id route param -> parametro de identificação
        
        const toggleHabitParams = z.object({
            id: z.string().uuid(),

        })

        const {id} = toggleHabitParams.parse(request.params)
        
        const today = dayjs().startOf('day').toDate()
        
        let day = await prisma.day.findUnique({
            where: {
                date: today,
            }
        })

        if(day){
           day = await prisma.day.create({
            data:{
                date: today,
            }
           }) 
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where:{
                 day_id_habit_id:{
                    day_id: day.id,
                    habit_id: id,
                 }
            }
        })

        if(dayHabit){
            //remover a marcação do completo
            await prisma.day.delete({
                where:{
                    id: dayHabit.id,
                }
            })
        }else{
            //Completar o habito nesse dia
            await prisma.dayHabit.create({
                data:{
                    day_id: day.id,
                    habit_id: id,
                }
            })

        }

    })

    app.get('/summary', async() =>{
        // quanto mais requisicao e condicao = SQL NA MAO
        // PRISMA ORM = RAW SQL => SQLITE

        const summary = await prisma.$queryRaw`
        SELECT D.id, D.date,
        (select cast(count(*) as float) from day_habits DH where DH.day_id = D.id ) as completed,
        (select cast(count(*) as float) from habit_week_days HWD 
        JOIN habits H on H.id = HWD.habit_id
        Where  HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int )
        and H.created_at <= D.date
         ) as amount
        FROM days D
        `
        return summary
    })

    
}


