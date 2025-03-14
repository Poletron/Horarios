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
        courseReferenceNumber: course.courseReferenceNumber, // NRC
        campusDescription: course.campusDescription // Añadir propiedad campus a las secciones
      });
    });
    
    return Object.values(groupedCourses);
  },
  
  /**
   * Genera todos los horarios posibles a partir de las materias seleccionadas
   * @param {Array} selectedSubjects - Materias seleccionadas (agrupadas)
   * @param {Boolean} onlyOpenSections - Si solo se consideran secciones abiertas
   * @param {String} selectedCampus - Campus para filtrar las secciones (opcional)
   * @return {Array} Combinaciones válidas de horarios
   */
  generatePossibleSchedules(selectedSubjects, onlyOpenSections = true, selectedCampus = '') {
    // Filtrar secciones abiertas si es necesario
    const filteredSubjects = selectedSubjects.map(subject => {
      // Filtrar primero por secciones abiertas si es necesario
      let sections = onlyOpenSections 
        ? subject.sections.filter(section => section.openSection) 
        : [...subject.sections];
      
      // Luego filtrar por campus si se ha seleccionado uno
      if (selectedCampus) {
        const sectionsInCampus = sections.filter(section => 
          section.campusDescription === selectedCampus
        );
        
        // Solo reemplazar las secciones si encontramos alguna en este campus
        if (sectionsInCampus.length > 0) {
          sections = sectionsInCampus;
        } else {
          // Si no hay secciones en este campus, mantenemos las secciones para mostrar advertencia después
          console.log(`No se encontraron secciones en ${selectedCampus} para ${subject.subject}${subject.courseNumber}`);
        }
      }
      
      return { ...subject, sections };
    });
    
    // Comprobar si hay materias sin secciones disponibles después del filtrado
    const invalidSubjects = filteredSubjects.filter(subject => subject.sections.length === 0);
    if (invalidSubjects.length > 0) {
      return {
        schedules: [],
        errors: invalidSubjects.map(subject => {
          const reason = selectedCampus 
            ? `en el campus "${selectedCampus}"` 
            : (onlyOpenSections ? 'abiertas' : 'disponibles');
          return `La materia ${subject.subject}${subject.courseNumber} (${subject.courseTitle}) no tiene secciones ${reason}.`;
        })
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
  },
  
  /**
   * Genera horarios posibles distinguiendo entre materias prioritarias y candidatas
   * @param {Array} prioritySubjects - Materias que deben estar en todos los horarios
   * @param {Array} candidateSubjects - Materias opcionales que pueden incluirse
   * @param {Boolean} onlyOpenSections - Si solo se consideran secciones abiertas
   * @param {String} selectedCampus - Campus para filtrar las secciones (opcional)
   * @return {Object} Resultado con los horarios generados y posibles errores
   */
  generatePossibleSchedulesWithCandidates(prioritySubjects, candidateSubjects, onlyOpenSections = true, selectedCampus = '') {
    // Si no hay materias prioritarias, mostrar mensaje de error
    if (prioritySubjects.length === 0 && candidateSubjects.length === 0) {
      return {
        schedules: [],
        errors: ['Debes seleccionar al menos una materia para generar horarios.']
      };
    }
    
    // Primer paso: Filtrar secciones según las opciones seleccionadas
    const filteredPrioritySubjects = this.filterSubjects(prioritySubjects, onlyOpenSections, selectedCampus);
    const filteredCandidateSubjects = this.filterSubjects(candidateSubjects, onlyOpenSections, selectedCampus);
    
    // Comprobar si hay materias prioritarias sin secciones disponibles
    const invalidPrioritySubjects = filteredPrioritySubjects.filter(subject => subject.sections.length === 0);
    if (invalidPrioritySubjects.length > 0) {
      return {
        schedules: [],
        errors: invalidPrioritySubjects.map(subject => {
          const reason = selectedCampus 
            ? `en el campus "${selectedCampus}"` 
            : (onlyOpenSections ? 'abiertas' : 'disponibles');
          return `La materia prioritaria ${subject.subject}${subject.courseNumber} (${subject.courseTitle}) no tiene secciones ${reason}.`;
        })
      };
    }
    
    // Segundo paso: Generar horarios con las materias prioritarias
    const prioritySchedules = this.generateCombinations(filteredPrioritySubjects);
    
    // Filtrar horarios prioritarios sin conflictos
    const validPrioritySchedules = prioritySchedules.filter(schedule => !this.hasScheduleConflict(schedule));
    
    if (validPrioritySchedules.length === 0) {
      return {
        schedules: [],
        errors: ['No fue posible generar horarios sin conflictos con las materias prioritarias seleccionadas.']
      };
    }
    
    // Si no hay materias candidatas, devolver los horarios con solo las prioritarias
    if (filteredCandidateSubjects.length === 0) {
      return {
        schedules: validPrioritySchedules,
        totalCombinations: prioritySchedules.length,
        validCombinations: validPrioritySchedules.length,
        errors: []
      };
    }
    
    // Tercer paso: Para cada horario prioritario válido, intentar añadir materias candidatas
    const finalSchedules = [];
    
    validPrioritySchedules.forEach(prioritySchedule => {
      // Intentar añadir cada materia candidata de forma individual
      const possibleAdditions = filteredCandidateSubjects.map(candidateSubject => {
        // Para cada sección de la materia candidata
        return candidateSubject.sections.map(section => {
          // Crear un nuevo item para el horario
          const candidateItem = {
            subjectId: candidateSubject.id,
            subject: candidateSubject.subject,
            courseNumber: candidateSubject.courseNumber,
            courseTitle: candidateSubject.courseTitle,
            creditHourLow: candidateSubject.creditHourLow,
            section: section
          };
          
          // Verificar si hay conflicto al añadir esta sección al horario prioritario
          const hasConflict = prioritySchedule.some(existingItem => 
            this.sectionsConflict(existingItem.section, section)
          );
          
          return {
            item: candidateItem,
            hasConflict: hasConflict
          };
        });
      }).flat();
      
      // Filtrar las secciones candidatas que no tienen conflicto
      const nonConflictingCandidates = possibleAdditions.filter(addition => !addition.hasConflict)
        .map(addition => addition.item);
      
      // Generar todas las posibles combinaciones de materias candidatas sin conflicto
      // Aquí necesitamos un algoritmo que genere todas las combinaciones posibles (0 o más elementos)
      const candidateCombinations = this.generateSubsetCombinations(nonConflictingCandidates);
      
      // Para cada combinación, crear un horario completo (prioritarias + candidatas)
      candidateCombinations.forEach(candidateCombo => {
        finalSchedules.push([...prioritySchedule, ...candidateCombo]);
      });
    });
    
    return {
      schedules: finalSchedules,
      totalPrioritySchedules: validPrioritySchedules.length,
      totalFinalSchedules: finalSchedules.length,
      errors: []
    };
  },
  
  /**
   * Filtra las secciones de las materias según las opciones seleccionadas
   * @param {Array} subjects - Lista de materias a filtrar
   * @param {Boolean} onlyOpenSections - Si solo se consideran secciones abiertas
   * @param {String} selectedCampus - Campus para filtrar las secciones (opcional)
   * @return {Array} Materias con secciones filtradas
   */
  filterSubjects(subjects, onlyOpenSections, selectedCampus) {
    return subjects.map(subject => {
      // Filtrar primero por secciones abiertas si es necesario
      let sections = onlyOpenSections 
        ? subject.sections.filter(section => section.openSection) 
        : [...subject.sections];
      
      // Luego filtrar por campus si se ha seleccionado uno
      if (selectedCampus) {
        const sectionsInCampus = sections.filter(section => 
          section.campusDescription === selectedCampus
        );
        
        // Solo reemplazar las secciones si encontramos alguna en este campus
        if (sectionsInCampus.length > 0) {
          sections = sectionsInCampus;
        }
      }
      
      return { ...subject, sections };
    });
  },
  
  /**
   * Genera todas las combinaciones posibles de subconjuntos (incluido el conjunto vacío)
   * @param {Array} items - Lista de elementos
   * @return {Array} Todas las posibles combinaciones (subconjuntos)
   */
  generateSubsetCombinations(items) {
    // Empezamos con el conjunto vacío
    const result = [[]];
    
    // Para cada elemento, generamos nuevas combinaciones añadiéndolo a las existentes
    for (const item of items) {
      const currentLength = result.length;
      for (let i = 0; i < currentLength; i++) {
        result.push([...result[i], item]);
      }
    }
    
    // Quitamos el conjunto vacío si no queremos incluirlo
    // result.shift();
    
    return result;
  }
};
