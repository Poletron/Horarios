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

    // Segundo paso: Generar horarios con las materias prioritarias usando algoritmo mejorado
    const prioritySchedules = this.generateCompatibleCombinationsWithSpecificSections(filteredPrioritySubjects);

    if (prioritySchedules.length === 0) {
      // En lugar de devolver error inmediatamente, intentar identificar qué materias causan conflictos
      const conflictAnalysis = this.analyzeScheduleConflicts(filteredPrioritySubjects);

      return {
        schedules: [],
        errors: [
          'No fue posible generar horarios sin conflictos con las materias prioritarias seleccionadas.',
          ...conflictAnalysis.suggestions
        ]
      };
    }

    // Si no hay materias candidatas, devolver los horarios con solo las prioritarias
    if (filteredCandidateSubjects.length === 0) {
      return {
        schedules: prioritySchedules,
        totalCombinations: this.calculateTotalCombinations(filteredPrioritySubjects),
        validCombinations: prioritySchedules.length,
        errors: []
      };
    }

    // Tercer paso: Para cada horario prioritario válido, intentar añadir materias candidatas
    const finalSchedules = [];

    prioritySchedules.forEach(prioritySchedule => {
      // Intentar añadir materias candidatas de forma inteligente
      const enhancedSchedules = this.addCandidateSubjects(prioritySchedule, filteredCandidateSubjects);
      finalSchedules.push(...enhancedSchedules);
    });

    return {
      schedules: finalSchedules,
      totalPrioritySchedules: prioritySchedules.length,
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
  },

  /**
   * Genera combinaciones de secciones priorizando compatibilidad
   * Este método es más inteligente que generateCombinations ya que evita generar
   * combinaciones que sabemos que tendrán conflictos
   * @param {Array} subjects - Materias con sus secciones
   * @return {Array} Combinaciones válidas sin conflictos
   */
  generateCompatibleCombinations(subjects) {
    if (subjects.length === 0) return [];

    // Función recursiva mejorada que verifica compatibilidad en cada paso
    const combineCompatible = (index, currentSchedule) => {
      // Si ya procesamos todas las materias, retornar la combinación actual
      if (index === subjects.length) {
        return [currentSchedule];
      }

      const currentSubject = subjects[index];
      let validCombinations = [];

      // IMPORTANTE: Para secciones específicas de la misma materia, solo seleccionar UNA sección
      // No múltiples secciones de la misma materia
      for (const section of currentSubject.sections) {
        // Verificar que no estemos añadiendo otra sección de la misma materia
        const alreadyHasThisSubject = currentSchedule.some(existingItem =>
          existingItem.subject === currentSubject.subject &&
          existingItem.courseNumber === currentSubject.courseNumber
        );

        if (alreadyHasThisSubject) {
          // Si ya tenemos una sección de esta materia, saltar esta sección
          continue;
        }

        // Crear el item de horario para esta sección
        const scheduleItem = {
          subjectId: currentSubject.id,
          subject: currentSubject.subject,
          courseNumber: currentSubject.courseNumber,
          courseTitle: currentSubject.courseTitle,
          creditHourLow: currentSubject.creditHourLow,
          section: section
        };

        // Verificar si esta sección es compatible con el horario actual
        const isCompatible = currentSchedule.every(existingItem =>
          !this.sectionsConflict(existingItem.section, section)
        );

        if (isCompatible) {
          // Si es compatible, continuar con las materias restantes
          const newSchedule = [...currentSchedule, scheduleItem];
          const remainingCombinations = combineCompatible(index + 1, newSchedule);
          validCombinations.push(...remainingCombinations);
        }
      }

      return validCombinations;
    };

    // Comenzar combinación desde la primera materia con un horario vacío
    return combineCompatible(0, []);
  },

  /**
   * Analiza los conflictos entre materias para proporcionar sugerencias útiles
   * @param {Array} subjects - Materias que causan conflictos
   * @return {Object} Análisis de conflictos con sugerencias
   */
  analyzeScheduleConflicts(subjects) {
    const suggestions = [];
    const conflictPairs = [];
    const detailedConflicts = [];

    // Analizar conflictos entre pares de materias
    for (let i = 0; i < subjects.length - 1; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const subject1 = subjects[i];
        const subject2 = subjects[j];

        // Verificar si todas las secciones de estas materias tienen conflictos
        const hasAnyCompatibleSections = this.hasCompatibleSections(subject1, subject2);

        if (!hasAnyCompatibleSections) {
          const conflictDetails = this.getDetailedConflictInfo(subject1, subject2);

          conflictPairs.push({
            subject1: `${subject1.subject}${subject1.courseNumber}`,
            subject2: `${subject2.subject}${subject2.courseNumber}`,
            title1: subject1.courseTitle,
            title2: subject2.courseTitle
          });

          detailedConflicts.push(conflictDetails);
        }
      }
    }

    // Generar sugerencias basadas en los conflictos encontrados
    if (conflictPairs.length > 0) {
      suggestions.push('Se encontraron conflictos de horario entre las siguientes materias:');

      conflictPairs.forEach((pair, index) => {
        suggestions.push(`• ${pair.subject1} (${pair.title1}) y ${pair.subject2} (${pair.title2})`);

        // Añadir detalles específicos del conflicto
        if (detailedConflicts[index]) {
          detailedConflicts[index].forEach(detail => {
            suggestions.push(`  - ${detail}`);
          });
        }
      });

      suggestions.push('Sugerencias:');
      suggestions.push('- Revisa si hay otras secciones disponibles para estas materias');
      suggestions.push('- Considera cambiar algunas materias de "Prioritaria" a "Candidata"');
      suggestions.push('- Verifica los horarios en el sistema oficial de la universidad');
    }

    return { suggestions, conflictPairs, detailedConflicts };
  },

  /**
   * Obtiene información detallada sobre los conflictos entre dos materias
   * @param {Object} subject1 - Primera materia
   * @param {Object} subject2 - Segunda materia
   * @return {Array} Lista de descripciones detalladas de conflictos
   */
  getDetailedConflictInfo(subject1, subject2) {
    const conflicts = [];

    // Analizar cada combinación de secciones
    subject1.sections.forEach(section1 => {
      subject2.sections.forEach(section2 => {
        if (this.sectionsConflict(section1, section2)) {
          const conflictInfo = this.getSpecificConflictInfo(section1, section2);
          if (conflictInfo) {
            conflicts.push(`NRC ${section1.courseReferenceNumber || section1.id} vs NRC ${section2.courseReferenceNumber || section2.id}: ${conflictInfo}`);
          }
        }
      });
    });

    return conflicts;
  },

  /**
   * Obtiene información específica sobre el conflicto entre dos secciones
   * @param {Object} section1 - Primera sección
   * @param {Object} section2 - Segunda sección
   * @return {String} Descripción específica del conflicto
   */
  getSpecificConflictInfo(section1, section2) {
    const conflicts = [];

    // Para cada reunión de la primera sección
    for (const meeting1 of section1.meetingsFaculty) {
      if (!meeting1.meetingTime) continue;

      // Para cada reunión de la segunda sección
      for (const meeting2 of section2.meetingsFaculty) {
        if (!meeting2.meetingTime) continue;

        const mt1 = meeting1.meetingTime;
        const mt2 = meeting2.meetingTime;

        // Identificar días compartidos
        const sharedDays = [];
        if (mt1.monday && mt2.monday) sharedDays.push('lunes');
        if (mt1.tuesday && mt2.tuesday) sharedDays.push('martes');
        if (mt1.wednesday && mt2.wednesday) sharedDays.push('miércoles');
        if (mt1.thursday && mt2.thursday) sharedDays.push('jueves');
        if (mt1.friday && mt2.friday) sharedDays.push('viernes');
        if (mt1.saturday && mt2.saturday) sharedDays.push('sábado');
        if (mt1.sunday && mt2.sunday) sharedDays.push('domingo');

        if (sharedDays.length > 0 && this.timesOverlap(mt1.beginTime, mt1.endTime, mt2.beginTime, mt2.endTime)) {
          const time1 = `${this.formatTime(mt1.beginTime)}-${this.formatTime(mt1.endTime)}`;
          const time2 = `${this.formatTime(mt2.beginTime)}-${this.formatTime(mt2.endTime)}`;

          conflicts.push(`conflicto ${sharedDays.join(', ')} (${time1} vs ${time2})`);
        }
      }
    }

    return conflicts.join(', ');
  },

  /**
   * Formatea una hora del formato HHMM al formato HH:MM
   * @param {String} timeStr - Hora en formato HHMM
   * @return {String} Hora en formato HH:MM
   */
  formatTime(timeStr) {
    if (!timeStr || timeStr.length !== 4) return timeStr;
    return `${timeStr.substring(0, 2)}:${timeStr.substring(2)}`;
  },

  /**
   * Verifica si dos materias tienen al menos algunas secciones compatibles
   * @param {Object} subject1 - Primera materia
   * @param {Object} subject2 - Segunda materia
   * @return {Boolean} true si hay al menos una combinación compatible
   */
  hasCompatibleSections(subject1, subject2) {
    for (const section1 of subject1.sections) {
      for (const section2 of subject2.sections) {
        if (!this.sectionsConflict(section1, section2)) {
          return true; // Encontramos al menos una combinación compatible
        }
      }
    }
    return false; // No hay combinaciones compatibles
  },

  /**
   * Añade materias candidatas a un horario prioritario existente
   * @param {Array} prioritySchedule - Horario con materias prioritarias
   * @param {Array} candidateSubjects - Materias candidatas a añadir
   * @return {Array} Lista de horarios mejorados con candidatas
   */
  addCandidateSubjects(prioritySchedule, candidateSubjects) {
    const enhancedSchedules = [prioritySchedule]; // Incluir el horario original

    // Para cada materia candidata, intentar añadirla si es compatible
    candidateSubjects.forEach(candidateSubject => {
      const newSchedules = [];

      enhancedSchedules.forEach(currentSchedule => {
        // Intentar cada sección de la materia candidata
        candidateSubject.sections.forEach(section => {
          // Verificar compatibilidad con el horario actual
          const isCompatible = currentSchedule.every(existingItem =>
            !this.sectionsConflict(existingItem.section, section)
          );

          if (isCompatible) {
            // Crear nuevo horario con la materia candidata añadida
            const candidateItem = {
              subjectId: candidateSubject.id,
              subject: candidateSubject.subject,
              courseNumber: candidateSubject.courseNumber,
              courseTitle: candidateSubject.courseTitle,
              creditHourLow: candidateSubject.creditHourLow,
              section: section
            };

            newSchedules.push([...currentSchedule, candidateItem]);
          }
        });
      });

      // Añadir los nuevos horarios a la lista
      enhancedSchedules.push(...newSchedules);
    });

    // Eliminar duplicados y devolver horarios únicos
    return this.removeDuplicateSchedules(enhancedSchedules);
  },

  /**
   * Elimina horarios duplicados basándose en las secciones incluidas
   * @param {Array} schedules - Lista de horarios
   * @return {Array} Lista de horarios únicos
   */
  removeDuplicateSchedules(schedules) {
    const uniqueSchedules = [];
    const seenSchedules = new Set();

    schedules.forEach(schedule => {
      // Crear una clave única basada en los IDs de las secciones
      const scheduleKey = schedule
        .map(item => item.section.id)
        .sort()
        .join('-');

      if (!seenSchedules.has(scheduleKey)) {
        seenSchedules.add(scheduleKey);
        uniqueSchedules.push(schedule);
      }
    });

    return uniqueSchedules;
  },

  /**
   * Calcula el número total de combinaciones posibles
   * @param {Array} subjects - Lista de materias
   * @return {Number} Número total de combinaciones
   */
  calculateTotalCombinations(subjects) {
    return subjects.reduce((total, subject) => total * subject.sections.length, 1);
  },

  /**
   * Genera combinaciones considerando que las secciones específicas de la misma materia
   * son alternativas mutuamente excluyentes, no acumulativas
   * @param {Array} subjects - Materias con sus secciones
   * @return {Array} Combinaciones válidas sin conflictos
   */
  generateCompatibleCombinationsWithSpecificSections(subjects) {
    if (subjects.length === 0) return [];

    // Función recursiva que trata las secciones específicas correctamente
    const combineCompatible = (index, currentSchedule) => {
      // Si ya procesamos todas las materias, retornar la combinación actual
      if (index === subjects.length) {
        return [currentSchedule];
      }

      const currentSubject = subjects[index];
      let validCombinations = [];

      // Para cada sección de la materia actual (cada una será una alternativa)
      for (const section of currentSubject.sections) {
        // Verificar que no estemos añadiendo otra sección de la misma materia
        const alreadyHasThisSubject = currentSchedule.some(existingItem =>
          existingItem.subject === currentSubject.subject &&
          existingItem.courseNumber === currentSubject.courseNumber
        );

        if (alreadyHasThisSubject) {
          // Si ya tenemos una sección de esta materia, saltar esta sección
          continue;
        }

        // Crear el item de horario para esta sección
        const scheduleItem = {
          subjectId: currentSubject.id,
          subject: currentSubject.subject,
          courseNumber: currentSubject.courseNumber,
          courseTitle: currentSubject.courseTitle,
          creditHourLow: currentSubject.creditHourLow,
          section: section
        };

        // Verificar si esta sección es compatible con el horario actual
        const isCompatible = currentSchedule.every(existingItem =>
          !this.sectionsConflict(existingItem.section, section)
        );

        if (isCompatible) {
          // Si es compatible, continuar con las materias restantes
          const newSchedule = [...currentSchedule, scheduleItem];
          const remainingCombinations = combineCompatible(index + 1, newSchedule);
          validCombinations.push(...remainingCombinations);
        }
      }

      return validCombinations;
    };

    // Comenzar combinación desde la primera materia con un horario vacío
    return combineCompatible(0, []);
  }
};
