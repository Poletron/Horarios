
/**
 * Servicio para generar horarios posibles a partir de materias seleccionadas
 */
export default {
  /**
   * Agrupa secciones por materia (misma asignatura y número de curso)
   * @param {Array} courses - Lista completa de cursos/secciones
   * @return {Array} Lista de materias con sus secciones agrupadas
   */
  groupCoursesBySubject(courses) {
    const groupedCourses = {};
    
    courses.forEach(course => {
      const courseKey = `${course.subject}${course.courseNumber}`;
      if (!groupedCourses[courseKey]) {
        groupedCourses[courseKey] = {
          id: courseKey,
          subject: course.subject,
          courseNumber: course.courseNumber,
          courseTitle: course.courseTitle,
          creditHourLow: course.creditHourLow,
          sections: []
        };
      }
      
      groupedCourses[courseKey].sections.push({
        id: course.id,
        sequenceNumber: course.sequenceNumber,
        openSection: course.openSection,
        scheduleType: course.scheduleTypeDescription,
        meetingsFaculty: course.meetingsFaculty,
        courseReferenceNumber: course.courseReferenceNumber // NRC
      });
    });
    
    return Object.values(groupedCourses);
  },
  
  /**
   * Genera todos los horarios posibles a partir de las materias seleccionadas
   * @param {Array} selectedSubjects - Materias seleccionadas (agrupadas)
   * @param {Boolean} onlyOpenSections - Si solo se consideran secciones abiertas
   * @return {Array} Combinaciones válidas de horarios
   */
  generatePossibleSchedules(selectedSubjects, onlyOpenSections = true) {
    // Filtrar secciones abiertas si es necesario
    const filteredSubjects = selectedSubjects.map(subject => {
      const sections = onlyOpenSections 
        ? subject.sections.filter(section => section.openSection) 
        : subject.sections;
      return { ...subject, sections };
    });
    
    // Comprobar si hay materias sin secciones disponibles
    const invalidSubjects = filteredSubjects.filter(subject => subject.sections.length === 0);
    if (invalidSubjects.length > 0) {
      return {
        schedules: [],
        errors: invalidSubjects.map(subject => 
          `La materia ${subject.subject}${subject.courseNumber} (${subject.courseTitle}) no tiene secciones ${onlyOpenSections ? 'abiertas' : 'disponibles'}.`
        )
      };
    }
    
    // Generar todas las combinaciones posibles de secciones
    const possibleSchedules = this.generateCombinations(filteredSubjects);
    
    // Filtrar combinaciones que tienen conflictos de horario
    const validSchedules = possibleSchedules.filter(schedule => !this.hasScheduleConflict(schedule));
    
    return {
      schedules: validSchedules,
      totalCombinations: possibleSchedules.length,
      validCombinations: validSchedules.length,
      errors: []
    };
  },
  
  /**
   * Genera todas las combinaciones posibles de secciones para las materias seleccionadas
   * @param {Array} subjects - Materias con sus secciones
   * @return {Array} Todas las combinaciones posibles
   */
  generateCombinations(subjects) {
    if (subjects.length === 0) return [];
    
    // Función recursiva para generar combinaciones
    const combine = (index, currentSchedule) => {
      // Si ya procesamos todas las materias, retornar la combinación actual
      if (index === subjects.length) {
        return [currentSchedule];
      }
      
      const currentSubject = subjects[index];
      let combinations = [];
      
      // Para cada sección de la materia actual
      currentSubject.sections.forEach(section => {
        // Crear una nueva combinación con esta sección
        const newSchedule = [...currentSchedule, {
          subjectId: currentSubject.id,
          subject: currentSubject.subject,
          courseNumber: currentSubject.courseNumber,
          courseTitle: currentSubject.courseTitle,
          creditHourLow: currentSubject.creditHourLow,
          section: section
        }];
        
        // Continuar combinando con las materias restantes
        combinations = [...combinations, ...combine(index + 1, newSchedule)];
      });
      
      return combinations;
    };
    
    // Comenzar combinación desde la primera materia con un horario vacío
    return combine(0, []);
  },
  
  /**
   * Verifica si hay conflictos de horario en una combinación de secciones
   * @param {Array} schedule - Una combinación de secciones de diferentes materias
   * @return {Boolean} true si hay conflicto, false si no hay conflicto
   */
  hasScheduleConflict(schedule) {
    for (let i = 0; i < schedule.length - 1; i++) {
      for (let j = i + 1; j < schedule.length; j++) {
        if (this.sectionsConflict(schedule[i].section, schedule[j].section)) {
          return true;
        }
      }
    }
    return false;
  },
  
  /**
   * Verifica si dos secciones tienen conflicto de horario
   * @param {Object} section1 - Primera sección
   * @param {Object} section2 - Segunda sección
   * @return {Boolean} true si hay conflicto, false si no hay conflicto
   */
  sectionsConflict(section1, section2) {
    // Para cada reunión de la primera sección
    for (const meeting1 of section1.meetingsFaculty) {
      if (!meeting1.meetingTime) continue;
      
      // Para cada reunión de la segunda sección
      for (const meeting2 of section2.meetingsFaculty) {
        if (!meeting2.meetingTime) continue;
        
        const mt1 = meeting1.meetingTime;
        const mt2 = meeting2.meetingTime;
        
        // Comprobar superposición de días
        if ((mt1.monday && mt2.monday) ||
            (mt1.tuesday && mt2.tuesday) ||
            (mt1.wednesday && mt2.wednesday) ||
            (mt1.thursday && mt2.thursday) ||
            (mt1.friday && mt2.friday) ||
            (mt1.saturday && mt2.saturday) ||
            (mt1.sunday && mt2.sunday)) {
          
          // Si comparten algún día, comprobar superposición de horas
          if (this.timesOverlap(mt1.beginTime, mt1.endTime, mt2.beginTime, mt2.endTime)) {
            return true; // Hay conflicto
          }
        }
      }
    }
    
    return false; // No hay conflicto
  },
  
  /**
   * Comprueba si dos rangos de tiempo se superponen
   * @param {String} start1 - Hora de inicio del primer rango (formato "HHMM")
   * @param {String} end1 - Hora de fin del primer rango (formato "HHMM")
   * @param {String} start2 - Hora de inicio del segundo rango (formato "HHMM")
   * @param {String} end2 - Hora de fin del segundo rango (formato "HHMM")
   * @return {Boolean} true si hay superposición, false si no hay superposición
   */
  timesOverlap(start1, end1, start2, end2) {
    // Convertir a minutos desde medianoche para facilitar comparación
    const toMinutes = timeStr => {
      if (!timeStr) return 0;
      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = parseInt(timeStr.substring(2), 10);
      return hours * 60 + minutes;
    };
    
    const start1Min = toMinutes(start1);
    const end1Min = toMinutes(end1);
    const start2Min = toMinutes(start2);
    const end2Min = toMinutes(end2);
    
    // Verificar superposición
    return (start1Min < end2Min) && (start2Min < end1Min);
  }
};
