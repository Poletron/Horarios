import { decodeHtmlEntities } from '../utils/HtmlUtils.js';

export default {
  async loadCourses() {
    try {
      // Cargar datos desde archivos JSON (pueden contener datos HTML convertidos o datos originales de API)
      const allCourses = await this.loadJsonData();
      
      // Log statistics
      const htmlCount = allCourses.filter(c => c.dataSource === 'html').length;
      const jsonCount = allCourses.filter(c => c.dataSource === 'json').length;
      
      console.log(`📊 Datos cargados exitosamente:`);
      console.log(`   • ${htmlCount} cursos desde HTML convertidos`);
      console.log(`   • ${jsonCount} cursos desde API original`);
      console.log(`   • ${allCourses.length} cursos totales disponibles`);
      
      if (htmlCount > 0) {
        console.log(`✅ Datos HTML convertidos disponibles`);
      }
      if (jsonCount > 0) {
        console.log(`✅ Datos API originales disponibles`);
      }
      
      return allCourses;
      
    } catch (error) {
      console.error('Error cargando los cursos:', error);
      throw error;
    }
  },



  async loadJsonData() {
    try {
      // Array con los nombres de los archivos de resultados
      const resultFiles = [];
      
      // Archivo base sin número
      resultFiles.push('results.json');
      
      // Archivo generado desde HTML
      resultFiles.push('generado.json');
      
      // Añadir archivos numerados (results1.json, results2.json, etc.)
      for (let i = 1; i <= 20; i++) {
        resultFiles.push(`results${i}.json`);
      }
      
      // Filtramos para incluir solo archivos que existen
      const existingFiles = await Promise.all(
        resultFiles.map(async file => {
          try {
            const response = await fetch(file, { method: 'HEAD' });
            return response.ok ? file : null;
          } catch (e) {
            return null;
          }
        })
      );
      
      // Cargamos todos los archivos existentes
      const responses = await Promise.all(
        existingFiles.filter(Boolean).map(file => fetch(file))
      );
      
      // Procesamos la respuesta de cada archivo
      const jsonDataArray = await Promise.all(
        responses.map(response => {
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }
          return response.json();
        })
      );
      
      // Combinamos todos los datos de los cursos
      const combinedCourses = [];
      const processedIds = new Set(); // Para evitar duplicados
      
      jsonDataArray.forEach(jsonData => {
        let coursesArray = [];
        
        // Manejar diferentes formatos de datos
        if (Array.isArray(jsonData)) {
          // Formato directo de array (datos del HTML convertidos)
          coursesArray = jsonData;
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
          // Formato original de la API { "data": [...] }
          coursesArray = jsonData.data;
        } else {
          console.warn('Formato de datos JSON no reconocido:', jsonData);
          return;
        }
        
        coursesArray.forEach(course => {
          // Para datos del HTML convertidos, usar el formato directo
          if (course.nrc && course.codigo) {
            // Es un curso del formato HTML
            const convertedCourse = this.convertHtmlToAppFormat(course);
            const courseId = convertedCourse.courseReferenceNumber;
            
            if (!processedIds.has(courseId)) {
              processedIds.add(courseId);
              combinedCourses.push(convertedCourse);
            }
          } else if (course.id) {
            // Es un curso del formato API original
            if (!processedIds.has(course.id)) {
              processedIds.add(course.id);
              combinedCourses.push({
                id: course.id,
                subject: course.subject,
                courseNumber: course.courseNumber,
                // Decodificar entidades HTML en los textos
                courseTitle: decodeHtmlEntities(course.courseTitle),
                sequenceNumber: course.sequenceNumber,
                courseReferenceNumber: course.courseReferenceNumber, // Adding NRC
                scheduleType: decodeHtmlEntities(course.scheduleTypeDescription),
                campusDescription: decodeHtmlEntities(course.campusDescription),
                creditHourLow: course.creditHourLow,
                openSection: course.openSection,
                meetingsFaculty: this.decodeMeetingsFaculty(course.meetingsFaculty),
                meetingDays: this.extractMeetingDays(course.meetingsFaculty),
                dataSource: 'json' // Marcar fuente de datos
              });
            }
          }
        });
      });
      
      return combinedCourses;
      
    } catch (error) {
      console.error('Error cargando datos JSON:', error);
      return [];
    }
  },
  
  convertHtmlToAppFormat(htmlSchedule) {
    // Extraer información del código de materia
    // Limpiar comillas simples y espacios extra
    const cleanCode = htmlSchedule.codigo.replace(/'/g, '').trim();
    const codeParts = cleanCode.split('-');
    const subject = codeParts[0] || '';
    // Limpiar el courseNumber de caracteres extra
    const courseNumber = (codeParts[1] || '').replace(/[^0-9]/g, '');
    
    // Extraer créditos del campo TAX (TA4 = 4 créditos)
    const credits = htmlSchedule.tax ? parseInt(htmlSchedule.tax.replace('TA', '')) || 0 : 0;
    
    // Convertir modalidad
    const modalityMap = {
      'PRE': 'Presencial',
      'VIT': 'Virtual',
      'LIN': 'En Línea',
      'HIB': 'Híbrido'
    };
    
    // Generar ID único basado en NRC
    const id = parseInt(htmlSchedule.nrc) || Math.random() * 1000000;
    
    // Convertir horarios a formato meetingsFaculty
    const meetingsFaculty = this.convertHtmlScheduleToMeetings(htmlSchedule);
    
    return {
      id: id,
      subject: subject,
      courseNumber: courseNumber,
      courseTitle: decodeHtmlEntities(htmlSchedule.asignatura.replace('.', '')),
      sequenceNumber: '001', // Valor por defecto
      courseReferenceNumber: htmlSchedule.nrc,
      scheduleType: modalityMap[htmlSchedule.mod] || htmlSchedule.mod,
      campusDescription: 'UCAB Montalbán', // Valor por defecto
      creditHourLow: credits,
      openSection: true, // Las secciones en el HTML se asumen abiertas (están disponibles para selección)
      meetingsFaculty: meetingsFaculty,
      meetingDays: this.extractMeetingDays(meetingsFaculty),
      dataSource: 'html', // Marcar fuente de datos
      professorName: htmlSchedule.profesor // Campo adicional para mostrar en UI
    };
  },

  convertHtmlScheduleToMeetings(htmlSchedule) {
    const meetings = [];
    const days = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    const dayMap = {
      'lun': 'monday',
      'mar': 'tuesday', 
      'mie': 'wednesday',
      'jue': 'thursday',
      'vie': 'friday',
      'sab': 'saturday',
      'dom': 'sunday'
    };
    
    days.forEach(day => {
      if (htmlSchedule[day] && htmlSchedule[day].trim()) {
        const timeSlot = htmlSchedule[day];
        const timeParts = timeSlot.split('/');
        
        if (timeParts.length === 2) {
          const startTime = timeParts[0].replace(':', ''); // Convertir 07:00 a 0700
          const endTime = timeParts[1].replace(':', '');   // Convertir 08:50 a 0850
          
          const meetingTime = {
            beginTime: startTime,
            endTime: endTime,
            monday: dayMap[day] === 'monday',
            tuesday: dayMap[day] === 'tuesday',
            wednesday: dayMap[day] === 'wednesday',
            thursday: dayMap[day] === 'thursday',
            friday: dayMap[day] === 'friday',
            saturday: dayMap[day] === 'saturday',
            sunday: dayMap[day] === 'sunday',
            meetingTypeDescription: 'Clase',
            room: null
          };
          
          meetings.push({
            meetingTime: meetingTime,
            faculty: htmlSchedule.profesor !== 'Por Asignar' ? [
              { displayName: htmlSchedule.profesor }
            ] : []
          });
        }
      }
    });
    
    return meetings;
  },



  decodeMeetingsFaculty(meetingsFaculty) {
    if (!meetingsFaculty || !Array.isArray(meetingsFaculty)) {
      return [];
    }
    
    return meetingsFaculty.map(meeting => {
      if (!meeting) return null;
      
      const decodedMeeting = { ...meeting };
      
      if (meeting.meetingTime) {
        decodedMeeting.meetingTime = { ...meeting.meetingTime };
        
        if (meeting.meetingTime.meetingTypeDescription) {
          decodedMeeting.meetingTime.meetingTypeDescription = 
            decodeHtmlEntities(meeting.meetingTime.meetingTypeDescription);
        }
      }
      
      return decodedMeeting;
    });
  },
  
  extractMeetingDays(meetingsFaculty) {
    if (!meetingsFaculty || !Array.isArray(meetingsFaculty) || meetingsFaculty.length === 0) {
      return [];
    }
    
    return meetingsFaculty.map(meeting => {
      if (!meeting.meetingTime) return null;
      
      const mt = meeting.meetingTime;
      
      return {
        beginTime: mt.beginTime,
        endTime: mt.endTime,
        monday: mt.monday,
        tuesday: mt.tuesday,
        wednesday: mt.wednesday,
        thursday: mt.thursday,
        friday: mt.friday,
        saturday: mt.saturday,
        sunday: mt.sunday,
        meetingType: decodeHtmlEntities(mt.meetingTypeDescription),
        room: mt.room
      };
    }).filter(meeting => meeting !== null);
  }
};
