import { decodeHtmlEntities } from '../utils/HtmlUtils.js';

export default {
  async loadCourses() {
    try {
      // Array con los nombres de los archivos de resultados
      // Array con los nombres de los archivos de resultados
      const resultFiles = [];
      
      // Archivo base sin número
      resultFiles.push('results.json');
      
      // Añadir archivos numerados (results1.json, results2.json, etc.)
      for (let i = 1; i <= 20; i++) {
        resultFiles.push(`results${i}.json`);
      }
      
      // Excluimos explícitamente cualquier archivo de sample
      const filteredResultFiles = resultFiles.filter(file => !file.includes('sample'));
      
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
        if (!jsonData.data || !Array.isArray(jsonData.data)) {
          return;
        }
        
        jsonData.data.forEach(course => {
          // Evitar duplicados por ID
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
              meetingDays: this.extractMeetingDays(course.meetingsFaculty)
            });
          }
        });
      });
      
      console.log(`Cargados ${combinedCourses.length} cursos de ${jsonDataArray.length} archivos.`);
      return combinedCourses;
      
    } catch (error) {
      console.error('Error cargando los cursos:', error);
      throw error;
    }
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
